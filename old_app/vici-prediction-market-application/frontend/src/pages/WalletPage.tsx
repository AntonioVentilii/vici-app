import { useState } from 'react';
import { useGetWalletBalance } from '../hooks/useQueries';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import SendTokenForm from '../components/SendTokenForm';
import ReceiveTokenPanel from '../components/ReceiveTokenPanel';
import type { WalletBalance } from '../backend';

export default function WalletPage() {
  const { data: walletBalance, isLoading, error } = useGetWalletBalance();

  const formatBalance = (amount: bigint | undefined) => {
    if (amount === undefined) return '0.00';
    // Convert from smallest unit (e8s for ICP, similar for ckUSDC)
    const value = Number(amount) / 100_000_000;
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-primary/10">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Wallet</h1>
            <p className="text-muted-foreground">Manage your ICP and ckUSDC tokens</p>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* ICP Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>ICP Balance</span>
                <TrendingUp className="h-5 w-5 text-primary" />
              </CardTitle>
              <CardDescription>Internet Computer Protocol</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : error ? (
                <p className="text-destructive text-sm">Failed to load balance</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-4xl font-bold">{formatBalance(walletBalance?.icp)}</p>
                  <p className="text-sm text-muted-foreground">ICP</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ckUSDC Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>ckUSDC Balance</span>
                <TrendingDown className="h-5 w-5 text-primary" />
              </CardTitle>
              <CardDescription>Chain-Key USD Coin</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : error ? (
                <p className="text-destructive text-sm">Failed to load balance</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-4xl font-bold">{formatBalance(walletBalance?.ckUSDC)}</p>
                  <p className="text-sm text-muted-foreground">ckUSDC</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Send/Receive Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>Send or receive tokens</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="send" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="send" className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4" />
                  Send
                </TabsTrigger>
                <TabsTrigger value="receive" className="flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4" />
                  Receive
                </TabsTrigger>
              </TabsList>
              <TabsContent value="send" className="mt-6">
                <SendTokenForm currentBalance={walletBalance || undefined} />
              </TabsContent>
              <TabsContent value="receive" className="mt-6">
                <ReceiveTokenPanel />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">About IC Wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              This wallet allows you to manage ICP (Internet Computer Protocol) and ckUSDC (Chain-Key USD Coin) tokens on the Internet Computer blockchain.
            </p>
            <p>
              <strong>Note:</strong> This is a demonstration wallet. In production, transactions would interact with the ICP Ledger and ckUSDC Ledger canisters via inter-canister calls.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
