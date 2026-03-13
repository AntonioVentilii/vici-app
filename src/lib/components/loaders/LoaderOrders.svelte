<script lang="ts">
	import IdentityAwareLoader from '$lib/components/loaders/IdentityAwareLoader.svelte';
	import { getUserOrders } from '$lib/services/order.services';
	import { ordersStore } from '$lib/stores/orders.store';

	const refresh = async () => {
		const orders = await getUserOrders();

		ordersStore.set(orders);
	};
</script>

<svelte:document onviciRefreshOrders={refresh} />

<IdentityAwareLoader onLoad={refresh} />
