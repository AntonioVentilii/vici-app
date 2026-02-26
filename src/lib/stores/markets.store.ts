import { initCertifiedSetterStore } from '$lib/stores/certified-setter.store';
import type { MarketMetadata } from '$lib/types/market';

// export type CkBtcPendingUtxosData = CertifiedData<CkBtcMinterDid.PendingUtxo[]>;
//
// interface MarketsStore extends CertifiedSetterStoreStore<MarketMetadata> {
// 	set: (params: { tokenId: TokenId; utxosIds: CertifiedData<UtxoTxidText[]> }) => void;
// }
//
// const initMarketsStore = (): CkBtcPendingUtxosStore => {
// 	const { subscribe, set, reset, reinitialize, update } =
// 		initCertifiedSetterStore<CkBtcPendingUtxosData>();
//
// 	return {
// 		filter: ({
// 			tokenId,
// 			utxosIds
// 		}: {
// 			tokenId: TokenId;
// 			utxosIds: CertifiedData<UtxoTxidText[]>;
// 		}) =>
// 			update((state) => ({
// 				...(nonNullish(state) && state),
// 				[tokenId]: {
// 					data: (state?.[tokenId]?.data ?? []).filter(
// 						({ outpoint: { txid: pendingTxid } }) =>
// 							!utxosIds.data.includes(uint8ArrayToHexString(pendingTxid))
// 					),
// 					certified: state?.[tokenId]?.certified ?? false
// 				}
// 			})),
// 		set,
// 		reset,
// 		reinitialize,
// 		subscribe
// 	};
// };

export const marketsStore = initCertifiedSetterStore<MarketMetadata>();
