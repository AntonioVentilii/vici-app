import Map "mo:core/Map";
import Set "mo:core/Set";
import Time "mo:core/Time";
import Array "mo:core/Array";

module {
  type OldMarket = {
    id : Nat;
    title : Text;
    description : Text;
    categories : [Text];
    expiration : Time.Time;
    inviteOnly : Bool;
    invitedUsers : Set.Set<Principal>;
    oddsYes : Float;
    oddsNo : Float;
    status : { #open; #closed; #resolved };
    createdBy : Principal;
    createdAt : Time.Time;
    resolvedOutcome : ?Bool;
  };

  type OldPosition = {
    marketId : Nat;
    positionType : { #yes; #no };
    amount : Nat;
    odds : Float;
    createdAt : Time.Time;
  };

  type OldTransaction = {
    id : Nat;
    user : Principal;
    marketId : ?Nat;
    positionType : ?{ #yes; #no };
    amount : Nat;
    odds : ?Float;
    transactionType : { #trade; #deposit; #payout };
    createdAt : Time.Time;
  };

  type OldUserProfile = {
    nickname : Text;
    avatar : Text;
    balance : Nat;
    createdAt : Time.Time;
    lastLogin : Time.Time;
  };

  type OldWalletBalance = {
    icp : Nat;
    ckUSDC : Nat;
  };

  type OldActor = {
    markets : Map.Map<Nat, OldMarket>;
    userProfiles : Map.Map<Principal, OldUserProfile>;
    userPositions : Map.Map<Principal, Set.Set<OldPosition>>;
    userTransactions : Map.Map<Principal, Set.Set<OldTransaction>>;
    nextMarketId : Nat;
    nextTransactionId : Nat;
    wallets : Map.Map<Principal, OldWalletBalance>;
    // Add other state fields as needed
  };

  public func run(old : OldActor) : OldActor {
    // No structural changes needed, just carry over the existing state
    old;
  };
};
