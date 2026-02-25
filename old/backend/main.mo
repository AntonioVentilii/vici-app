import Map "mo:core/Map";
import Set "mo:core/Set";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Int "mo:core/Int";
import Order "mo:core/Order";
import Time "mo:core/Time";
import Float "mo:core/Float";
import Array "mo:core/Array";
import AccessControl "authorization/access-control";
import Migration "migration";

(with migration = Migration.run)
actor {
  // Type Definitions
  type MarketStatus = { #open; #closed; #resolved };
  type PositionType = { #yes; #no };

  type Market = {
    id : Nat;
    title : Text;
    description : Text;
    categories : [Text];
    expiration : Time.Time;
    inviteOnly : Bool;
    invitedUsers : Set.Set<Principal>;
    oddsYes : Float; // Odds are stored as floats between 0.0 and 1.0
    oddsNo : Float;
    status : MarketStatus;
    createdBy : Principal;
    createdAt : Time.Time;
    resolvedOutcome : ?Bool;
  };

  type MarketSnapshot = {
    id : Nat;
    title : Text;
    description : Text;
    categories : [Text];
    expiration : Time.Time;
    inviteOnly : Bool;
    invitedUsers : [Principal];
    oddsYes : Float;
    oddsNo : Float;
    status : MarketStatus;
    createdBy : Principal;
    createdAt : Time.Time;
    resolvedOutcome : ?Bool;
  };

  type Position = {
    marketId : Nat;
    positionType : PositionType;
    amount : Nat;
    odds : Float; // Odds are stored as floats between 0.0 and 1.0
    createdAt : Time.Time;
  };

  type Transaction = {
    id : Nat;
    user : Principal;
    marketId : ?Nat;
    positionType : ?PositionType;
    amount : Nat;
    odds : ?Float;
    transactionType : { #trade; #deposit; #payout };
    createdAt : Time.Time;
  };

  type UserProfile = {
    nickname : Text;
    avatar : Text;
    balance : Nat;
    createdAt : Time.Time;
    lastLogin : Time.Time;
  };

  type Comment = {
    id : Nat;
    marketId : Nat;
    user : Principal;
    content : Text;
    createdAt : Time.Time;
    isHidden : Bool;
  };

  type MarketDepthPosition = {
    user : Principal;
    nickname : Text;
    positionType : PositionType;
    amount : Nat;
    odds : Float; // Odds are stored as floats between 0.0 and 1.0
  };

  type AnalyticsDataPoint = {
    timestamp : Time.Time;
    volume : Nat;
    oddsYes : Float;
    oddsNo : Float;
  };

  type WalletBalance = {
    icp : Nat;
    ckUSDC : Nat;
  };

  // Persistent compare modules for sorting
  module Market {
    public func compare(m1 : Market, m2 : Market) : Order.Order {
      Text.compare(m1.title, m2.title);
    };
  };

  module Position {
    public func compare(p1 : Position, p2 : Position) : Order.Order {
      Nat.compare(p1.marketId, p2.marketId);
    };
  };

  module Transaction {
    public func compare(t1 : Transaction, t2 : Transaction) : Order.Order {
      Nat.compare(t1.id, t2.id);
    };
  };

  module Comment {
    public func compare(c1 : Comment, c2 : Comment) : Order.Order {
      if (c1.id != c2.id) {
        Nat.compare(c1.id, c2.id);
      } else {
        Int.compare(c1.createdAt, c2.createdAt);
      };
    };
  };

  // Access Control
  let accessControlState = AccessControl.initState();

  // State
  let markets = Map.empty<Nat, Market>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let userPositions = Map.empty<Principal, Set.Set<Position>>();
  let userTransactions = Map.empty<Principal, Set.Set<Transaction>>();
  let marketComments = Map.empty<Nat, Set.Set<Comment>>();
  let marketAnalytics = Map.empty<Nat, [AnalyticsDataPoint]>();
  let userFriends = Map.empty<Principal, Set.Set<Principal>>();
  var nextMarketId = 1;
  var nextTransactionId = 1;
  var nextCommentId = 1;

  let wallets = Map.empty<Principal, WalletBalance>();

  // Constants
  let INITIAL_BALANCE : Nat = 1000;

  // Access Control System
  public shared ({ caller }) func initializeAccessControl() : async () {
    AccessControl.initialize(accessControlState, caller);
  };

  public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
    AccessControl.getUserRole(accessControlState, caller);
  };

  public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
    AccessControl.assignRole(accessControlState, caller, user, role);
  };

  public query ({ caller }) func isCallerAdmin() : async Bool {
    AccessControl.isAdmin(accessControlState, caller);
  };

  // User Profile Functions

  public shared ({ caller }) func createUserProfile(nickname : Text, avatar : Text) : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Anonymous users cannot create profiles");
    };

    switch (userProfiles.get(caller)) {
      case (?_) {
        Runtime.trap("User profile already exists");
      };
      case null {
        let profile : UserProfile = {
          nickname = nickname;
          avatar = avatar;
          balance = INITIAL_BALANCE;
          createdAt = Time.now();
          lastLogin = Time.now();
        };
        userProfiles.add(caller, profile);

        let wallet : WalletBalance = {
          icp = 0;
          ckUSDC = INITIAL_BALANCE;
        };
        wallets.add(caller, wallet);
      };
    };
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get their profile");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func updateLastLogin() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update login");
    };

    switch (userProfiles.get(caller)) {
      case (?profile) {
        let updatedProfile = {
          profile with
          lastLogin = Time.now();
        };
        userProfiles.add(caller, updatedProfile);
      };
      case null {
        Runtime.trap("User profile not found");
      };
    };
  };

  // Market Functions

  public shared ({ caller }) func createMarket(
    title : Text,
    description : Text,
    categories : [Text],
    expiration : Time.Time,
    inviteOnly : Bool,
    invitedUsers : [Principal],
  ) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create markets");
    };

    let marketId = nextMarketId;
    nextMarketId += 1;

    let invitedSet = Set.empty<Principal>();
    for (user in invitedUsers.vals()) {
      invitedSet.add(user);
    };

    let market : Market = {
      id = marketId;
      title = title;
      description = description;
      categories = categories;
      expiration = expiration;
      inviteOnly = inviteOnly;
      invitedUsers = invitedSet;
      oddsYes = 0.5; // Default odds 50% represented as 0.5
      oddsNo = 0.5;
      status = #open;
      createdBy = caller;
      createdAt = Time.now();
      resolvedOutcome = null;
    };

    markets.add(marketId, market);
    marketId;
  };

  public query func getMarket(marketId : Nat) : async ?MarketSnapshot {
    switch (markets.get(marketId)) {
      case (?market) {
        ?{
          id = market.id;
          title = market.title;
          description = market.description;
          categories = market.categories;
          expiration = market.expiration;
          inviteOnly = market.inviteOnly;
          invitedUsers = market.invitedUsers.toArray();
          oddsYes = market.oddsYes;
          oddsNo = market.oddsNo;
          status = market.status;
          createdBy = market.createdBy;
          createdAt = market.createdAt;
          resolvedOutcome = market.resolvedOutcome;
        };
      };
      case null { null };
    };
  };

  public query func getAllMarkets() : async [MarketSnapshot] {
    let marketArray = markets.toArray();
    marketArray.map<(Nat, Market), MarketSnapshot>(
      func((_, market)) : MarketSnapshot {
        {
          id = market.id;
          title = market.title;
          description = market.description;
          categories = market.categories;
          expiration = market.expiration;
          inviteOnly = market.inviteOnly;
          invitedUsers = market.invitedUsers.toArray();
          oddsYes = market.oddsYes;
          oddsNo = market.oddsNo;
          status = market.status;
          createdBy = market.createdBy;
          createdAt = market.createdAt;
          resolvedOutcome = market.resolvedOutcome;
        };
      },
    );
  };

  public query ({ caller }) func getMarketsByCategory(category : Text) : async [MarketSnapshot] {
    let marketArray = markets.toArray();
    let filtered = marketArray.filter(
      func((_, market)) : Bool {
        market.categories.find<Text>(func(cat) : Bool { cat == category }) != null;
      },
    );
    filtered.map<(Nat, Market), MarketSnapshot>(
      func((_, market)) : MarketSnapshot {
        {
          id = market.id;
          title = market.title;
          description = market.description;
          categories = market.categories;
          expiration = market.expiration;
          inviteOnly = market.inviteOnly;
          invitedUsers = market.invitedUsers.toArray();
          oddsYes = market.oddsYes;
          oddsNo = market.oddsNo;
          status = market.status;
          createdBy = market.createdBy;
          createdAt = market.createdAt;
          resolvedOutcome = market.resolvedOutcome;
        };
      },
    );
  };

  public shared ({ caller }) func resolveMarket(marketId : Nat, outcome : Bool) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can resolve markets");
    };

    switch (markets.get(marketId)) {
      case (?market) {
        if (market.status == #resolved) {
          Runtime.trap("Market is already resolved");
        };

        let updatedMarket = {
          market with
          status = #resolved;
          resolvedOutcome = ?outcome;
        };
        markets.add(marketId, updatedMarket);

        // Process payouts
        await processPayouts(marketId, outcome);
      };
      case null {
        Runtime.trap("Market not found");
      };
    };
  };

  func processPayouts(marketId : Nat, outcome : Bool) : async () {
    for ((user, positions) in userPositions.entries()) {
      let positionsArray = positions.toArray();
      for (position in positionsArray.vals()) {
        if (position.marketId == marketId) {
          let won = switch (position.positionType) {
            case (#yes) { outcome };
            case (#no) { not outcome };
          };

          if (won) {
            let payout = Int.abs(position.amount);
            switch (userProfiles.get(user)) {
              case (?profile) {
                let updatedProfile = {
                  profile with
                  balance = profile.balance + payout;
                };
                userProfiles.add(user, updatedProfile);

                let transactionId = nextTransactionId;
                nextTransactionId += 1;

                let transaction : Transaction = {
                  id = transactionId;
                  user = user;
                  marketId = ?marketId;
                  positionType = ?position.positionType;
                  amount = payout;
                  odds = ?position.odds;
                  transactionType = #payout;
                  createdAt = Time.now();
                };

                switch (userTransactions.get(user)) {
                  case (?transactions) {
                    transactions.add(transaction);
                  };
                  case null {
                    let newTransactions = Set.empty<Transaction>();
                    newTransactions.add(transaction);
                    userTransactions.add(user, newTransactions);
                  };
                };
              };
              case null {};
            };
          };
        };
      };
    };
  };

  // Position Functions

  public shared ({ caller }) func placePosition(
    marketId : Nat,
    positionType : PositionType,
    amount : Nat,
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can place positions");
    };

    switch (markets.get(marketId)) {
      case (?market) {
        if (market.status != #open) {
          Runtime.trap("Market is not open for trading");
        };

        if (market.inviteOnly and not market.invitedUsers.contains(caller)) {
          Runtime.trap("User is not invited to this market");
        };

        switch (userProfiles.get(caller)) {
          case (?profile) {
            if (profile.balance < amount) {
              Runtime.trap("Insufficient balance");
            };

            let odds = switch (positionType) {
              case (#yes) { market.oddsYes };
              case (#no) { market.oddsNo };
            };

            let position : Position = {
              marketId = marketId;
              positionType = positionType;
              amount = amount;
              odds = odds;
              createdAt = Time.now();
            };

            switch (userPositions.get(caller)) {
              case (?positions) {
                positions.add(position);
              };
              case null {
                let newPositions = Set.empty<Position>();
                newPositions.add(position);
                userPositions.add(caller, newPositions);
              };
            };

            let updatedProfile = {
              profile with
              balance = profile.balance - amount;
            };
            userProfiles.add(caller, updatedProfile);

            let transactionId = nextTransactionId;
            nextTransactionId += 1;

            let transaction : Transaction = {
              id = transactionId;
              user = caller;
              marketId = ?marketId;
              positionType = ?positionType;
              amount = amount;
              odds = ?odds;
              transactionType = #trade;
              createdAt = Time.now();
            };

            switch (userTransactions.get(caller)) {
              case (?transactions) {
                transactions.add(transaction);
              };
              case null {
                let newTransactions = Set.empty<Transaction>();
                newTransactions.add(transaction);
                userTransactions.add(caller, newTransactions);
              };
            };

            // Update market odds
            updateMarketOdds(marketId);
          };
          case null {
            Runtime.trap("User profile not found");
          };
        };
      };
      case null {
        Runtime.trap("Market not found");
      };
    };
  };

  func updateMarketOdds(marketId : Nat) {
    switch (markets.get(marketId)) {
      case (?market) {
        var totalYes : Nat = 0;
        var totalNo : Nat = 0;

        for ((_, positions) in userPositions.entries()) {
          let positionsArray = positions.toArray();
          for (position in positionsArray.vals()) {
            if (position.marketId == marketId) {
              switch (position.positionType) {
                case (#yes) { totalYes += position.amount };
                case (#no) { totalNo += position.amount };
              };
            };
          };
        };

        let total = totalYes + totalNo;
        if (total > 0) {
          let oddsYes = totalYes.toFloat() / total.toFloat();
          let oddsNo = totalNo.toFloat() / total.toFloat();

          let updatedMarket = {
            market with
            oddsYes = oddsYes;
            oddsNo = oddsNo;
          };
          markets.add(marketId, updatedMarket);
        };
      };
      case null {};
    };
  };

  public query ({ caller }) func getUserPositions() : async [Position] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get their positions");
    };
    switch (userPositions.get(caller)) {
      case (?positions) {
        positions.toArray();
      };
      case null { [] };
    };
  };

  public query ({ caller }) func getMarketDepth(marketId : Nat) : async [MarketDepthPosition] {
    var depthPositions : [MarketDepthPosition] = [];

    for ((user, positions) in userPositions.entries()) {
      let positionsArray = positions.toArray();
      for (position in positionsArray.vals()) {
        if (position.marketId == marketId) {
          switch (userProfiles.get(user)) {
            case (?profile) {
              let depthPosition : MarketDepthPosition = {
                user = user;
                nickname = profile.nickname;
                positionType = position.positionType;
                amount = position.amount;
                odds = position.odds;
              };
              depthPositions := depthPositions.concat([depthPosition]);
            };
            case null {};
          };
        };
      };
    };

    depthPositions;
  };

  // Transaction Functions

  public query ({ caller }) func getUserTransactions() : async [Transaction] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get their transactions");
    };
    switch (userTransactions.get(caller)) {
      case (?transactions) {
        transactions.toArray();
      };
      case null { [] };
    };
  };

  // Comment Functions

  public shared ({ caller }) func addComment(marketId : Nat, content : Text) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add comments");
    };

    switch (markets.get(marketId)) {
      case (?_) {
        let commentId = nextCommentId;
        nextCommentId += 1;

        let comment : Comment = {
          id = commentId;
          marketId = marketId;
          user = caller;
          content = content;
          createdAt = Time.now();
          isHidden = false;
        };

        switch (marketComments.get(marketId)) {
          case (?comments) {
            comments.add(comment);
          };
          case null {
            let newComments = Set.empty<Comment>();
            newComments.add(comment);
            marketComments.add(marketId, newComments);
          };
        };

        commentId;
      };
      case null {
        Runtime.trap("Market not found");
      };
    };
  };

  public query func getMarketComments(marketId : Nat) : async [Comment] {
    switch (marketComments.get(marketId)) {
      case (?comments) {
        let commentsArray = comments.toArray();
        commentsArray.filter<Comment>(
          func(comment) : Bool {
            not comment.isHidden;
          },
        );
      };
      case null { [] };
    };
  };

  public shared ({ caller }) func hideComment(commentId : Nat, marketId : Nat) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can hide comments");
    };

    switch (marketComments.get(marketId)) {
      case (?comments) {
        let commentsArray = comments.toArray();
        for (comment in commentsArray.vals()) {
          if (comment.id == commentId) {
            comments.remove(comment);
            let hiddenComment = {
              comment with
              isHidden = true;
            };
            comments.add(hiddenComment);
          };
        };
      };
      case null {
        Runtime.trap("Market not found");
      };
    };
  };

  // Analytics Functions

  public query func getMarketAnalytics(marketId : Nat) : async [AnalyticsDataPoint] {
    switch (marketAnalytics.get(marketId)) {
      case (?analytics) { analytics };
      case null { [] };
    };
  };

  public shared ({ caller }) func updateMarketAnalytics(marketId : Nat) : async () {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can update analytics");
    };

    switch (markets.get(marketId)) {
      case (?market) {
        var volume : Nat = 0;

        for ((_, positions) in userPositions.entries()) {
          let positionsArray = positions.toArray();
          for (position in positionsArray.vals()) {
            if (position.marketId == marketId) {
              volume += position.amount;
            };
          };
        };

        let dataPoint : AnalyticsDataPoint = {
          timestamp = Time.now();
          volume = volume;
          oddsYes = market.oddsYes;
          oddsNo = market.oddsNo;
        };

        switch (marketAnalytics.get(marketId)) {
          case (?analytics) {
            let updatedAnalytics = analytics.concat([dataPoint]);
            marketAnalytics.add(marketId, updatedAnalytics);
          };
          case null {
            marketAnalytics.add(marketId, [dataPoint]);
          };
        };
      };
      case null {
        Runtime.trap("Market not found");
      };
    };
  };

  // Friend Functions

  public shared ({ caller }) func addFriend(friend : Principal) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add friends");
    };

    if (caller == friend) {
      Runtime.trap("Cannot add yourself as a friend");
    };

    switch (userFriends.get(caller)) {
      case (?friends) {
        friends.add(friend);
      };
      case null {
        let newFriends = Set.empty<Principal>();
        newFriends.add(friend);
        userFriends.add(caller, newFriends);
      };
    };
  };

  public shared ({ caller }) func removeFriend(friend : Principal) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can remove friends");
    };

    switch (userFriends.get(caller)) {
      case (?friends) {
        friends.remove(friend);
      };
      case null {};
    };
  };

  public query ({ caller }) func getFriends() : async [Principal] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get their friends");
    };
    switch (userFriends.get(caller)) {
      case (?friends) {
        friends.toArray();
      };
      case null { [] };
    };
  };

  public query ({ caller }) func getFriendsPositions() : async [(Principal, [Position])] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get their friends' positions");
    };
    switch (userFriends.get(caller)) {
      case (?friends) {
        let friendsArray = friends.toArray();
        friendsArray.map(
          func(friend) {
            let positions = switch (userPositions.get(friend)) {
              case (?pos) { pos.toArray() };
              case null { [] };
            };
            (friend, positions);
          }
        );
      };
      case null { [] };
    };
  };

  // Wallet Functions

  public query ({ caller }) func getWalletBalance() : async ?WalletBalance {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can get their wallet balance");
    };
    wallets.get(caller);
  };

  public shared ({ caller }) func depositFunds(amount : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can deposit funds");
    };

    switch (wallets.get(caller)) {
      case (?wallet) {
        let updatedWallet = {
          wallet with
          ckUSDC = wallet.ckUSDC + amount;
        };
        wallets.add(caller, updatedWallet);

        switch (userProfiles.get(caller)) {
          case (?profile) {
            let updatedProfile = {
              profile with
              balance = profile.balance + amount;
            };
            userProfiles.add(caller, updatedProfile);
          };
          case null {};
        };

        let transactionId = nextTransactionId;
        nextTransactionId += 1;

        let transaction : Transaction = {
          id = transactionId;
          user = caller;
          marketId = null;
          positionType = null;
          amount = amount;
          odds = null;
          transactionType = #deposit;
          createdAt = Time.now();
        };

        switch (userTransactions.get(caller)) {
          case (?transactions) {
            transactions.add(transaction);
          };
          case null {
            let newTransactions = Set.empty<Transaction>();
            newTransactions.add(transaction);
            userTransactions.add(caller, newTransactions);
          };
        };
      };
      case null {
        Runtime.trap("Wallet not found");
      };
    };
  };

  public shared ({ caller }) func withdrawFunds(amount : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can withdraw funds");
    };

    switch (wallets.get(caller)) {
      case (?wallet) {
        if (wallet.ckUSDC < amount) {
          Runtime.trap("Insufficient balance");
        };

        let updatedWallet = {
          wallet with
          ckUSDC = wallet.ckUSDC - amount;
        };
        wallets.add(caller, updatedWallet);

        switch (userProfiles.get(caller)) {
          case (?profile) {
            let updatedProfile = {
              profile with
              balance = profile.balance - amount;
            };
            userProfiles.add(caller, updatedProfile);
          };
          case null {};
        };
      };
      case null {
        Runtime.trap("Wallet not found");
      };
    };
  };
};
