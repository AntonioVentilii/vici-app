typescript
import { PrismaClient } from '@prisma/client';
import { TournamentStatus } from '../types/tournament';
import { VXP_AWARD_CONFIGS } from '../constants/vxp-awards';

const prisma = new PrismaClient();

interface TournamentResult {
  tournamentId: string;
  firstPlaceUserId: string;
  secondPlaceUserId: string;
  thirdPlaceUserId: string;
}

function validateTournamentId(tournamentId: string): void {
  if (!tournamentId || typeof tournamentId !== 'string') {
    throw new Error('Invalid tournament ID: must be a non-empty string');
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tournamentId)) {
    throw new Error('Invalid tournament ID format: must be a valid UUID');
  }
}

function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID: must be a non-empty string');
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error('Invalid user ID format: must be a valid UUID');
  }
}

export async function finalizeTournamentPrizes(result: TournamentResult): Promise<void> {
  validateTournamentId(result.tournamentId);
  validateUserId(result.firstPlaceUserId);
  validateUserId(result.secondPlaceUserId);
  validateUserId(result.thirdPlaceUserId);

  const tournament = await prisma.tournament.findUnique({
    where: { id: result.tournamentId },
    include: {
      participants: true,
    },
  });

  if (!tournament) {
    throw new Error(`Tournament ${result.tournamentId} not found`);
  }

  if (tournament.status !== TournamentStatus.COMPLETED) {
    throw new Error(`Tournament ${result.tournamentId} is not in completed status`);
  }

  const participantIds = new Set(tournament.participants.map(p => p.userId));
  const providedUserIds = [result.firstPlaceUserId, result.secondPlaceUserId, result.thirdPlaceUserId];
  
  for (const userId of providedUserIds) {
    if (!participantIds.has(userId)) {
      throw new Error(`User ${userId} is not a participant of tournament ${result.tournamentId}`);
    }
  }

  if (new Set(providedUserIds).size !== providedUserIds.length) {
    throw new Error('Duplicate user IDs provided for tournament prizes');
  }

  await prisma.$transaction(async (tx) => {
    try {
      await tx.tournament.update({
        where: { id: result.tournamentId },
        data: {
          firstPlaceUserId: result.firstPlaceUserId,
          secondPlaceUserId: result.secondPlaceUserId,
          thirdPlaceUserId: result.thirdPlaceUserId,
          status: TournamentStatus.PRIZES_DISTRIBUTED,
        },
      });

      await tx.tournamentResult.create({
        data: {
          tournamentId: result.tournamentId,
          firstPlaceUserId: result.firstPlaceUserId,
          secondPlaceUserId: result.secondPlaceUserId,
          thirdPlaceUserId: result.thirdPlaceUserId,
        },
      });

      const vxpConfig = VXP_AWARD_CONFIGS.tournament_placement;
      const placements = [
        { userId: result.firstPlaceUserId, points: vxpConfig.firstPlace },
        { userId: result.secondPlaceUserId, points: vxpConfig.secondPlace },
        { userId: result.thirdPlaceUserId, points: vxpConfig.thirdPlace },
      ];

      for (const placement of placements) {
        await tx.userVxp.update({
          where: { userId: placement.userId },
          data: {
            points: { increment: placement.points },
          },
        });
      }
    } catch (error) {
      throw new Error(`Failed to finalize tournament prizes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

export async function getTournamentLeaderboard(tournamentId: string): Promise<Array<{ userId: string; score: number; rank: number }>> {
  validateTournamentId(tournamentId);

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        include: {
          predictions: true,
        },
      },
    },
  });

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  if (tournament.participants.length === 0) {
    return [];
  }

  const leaderboard = tournament.participants.map((participant) => {
    const totalScore = participant.predictions.reduce((sum, prediction) => {
      return sum + (prediction.isCorrect ? 1 : 0);
    }, 0);

    return {
      userId: participant.userId,
      score: totalScore,
      rank: 0,
    };
  });

  leaderboard.sort((a, b) => b.score - a.score);

  let currentRank = 1;
  let previousScore = leaderboard[0]?.score;

  for (const entry of leaderboard) {
    if (entry.score < previousScore) {
      currentRank++;
      previousScore = entry.score;
    }
    entry.rank = currentRank;
  }

  return leaderboard;
}

export async function distributeTournamentPrizes(tournamentId: string): Promise<void> {
  validateTournamentId(tournamentId);

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: {
        include: {
          predictions: true,
        },
      },
    },
  });

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  if (tournament.status !== TournamentStatus.COMPLETED) {
    throw new Error(`Tournament ${tournamentId} is not in completed status`);
  }

  if (tournament.participants.length < 3) {
    throw new Error(`Insufficient participants to distribute prizes for tournament ${tournamentId}: minimum 3 required, got ${tournament.participants.length}`);
  }

  const leaderboard = await getTournamentLeaderboard(tournamentId);

  const firstPlace = leaderboard.find((entry) => entry.rank === 1);
  const secondPlace = leaderboard.find((entry) => entry.rank === 2);
  const thirdPlace = leaderboard.find((entry) => entry.rank === 3);

  if (!firstPlace || !secondPlace || !thirdPlace) {
    throw new Error(`Insufficient participants to distribute prizes for tournament ${tournamentId}`);
  }

  const winnerIds = new Set([firstPlace.userId, secondPlace.userId, thirdPlace.userId]);
  if (winnerIds.size !== 3) {
    throw new Error(`Duplicate winners detected for tournament ${tournamentId}`);
  }

  await prisma.$transaction(async (tx) => {
    try {
      await tx.tournament.update({
        where: { id: tournamentId },
        data: {
          firstPlaceUserId: firstPlace.userId,
          secondPlaceUserId: secondPlace.userId,
          thirdPlaceUserId: thirdPlace.userId,
          status: TournamentStatus.PRIZES_DISTRIBUTED,
        },
      });

      await tx.tournamentResult.create({
        data: {
          tournamentId: tournamentId,
          firstPlaceUserId: firstPlace.userId,
          secondPlaceUserId: secondPlace.userId,
          thirdPlaceUserId: thirdPlace.userId,
        },
      });

      const vxpConfig = VXP_AWARD_CONFIGS.tournament_placement;
      const placements = [
        { userId: firstPlace.userId, points: vxpConfig.firstPlace },
        { userId: secondPlace.userId, points: vxpConfig.secondPlace },
        { userId: thirdPlace.userId, points: vxpConfig.thirdPlace },
      ];

      for (const placement of placements) {
        await tx.userVxp.update({
          where: { userId: placement.userId },
          data: {
            points: { increment: placement.points },
          },
        });
      }
    } catch (error) {
      throw new Error(`Failed to distribute tournament prizes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

export async function getTournamentPrizePool(tournamentId: string): Promise<number> {
  validateTournamentId(tournamentId);

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { prizePool: true },
  });

  if (!tournament) {
    throw new Error(`Tournament ${tournamentId} not found`);
  }

  if (tournament.prizePool === null || tournament.prizePool === undefined) {
    return 0;
  }

  return tournament.prizePool;
}