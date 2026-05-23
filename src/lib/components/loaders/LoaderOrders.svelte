<script lang="ts">
	import DomainCachedLoader from '$lib/components/loaders/DomainCachedLoader.svelte';
	import { VICI_EVENTS } from '$lib/constants/events.constants';
	import { loadUserOrders } from '$lib/services/order.services';
	import { ordersStore } from '$lib/stores/orders.store';
</script>

<DomainCachedLoader
	onLoad={loadUserOrders}
	refreshEvent={VICI_EVENTS.REFRESH_ORDERS}
	store={ordersStore}
/>
