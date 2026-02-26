import { idlFactory as idlFactoryClearing } from '$declarations/clearing/clearing.idl';
import { idlFactory as idlFactoryRegistry } from '$declarations/registry/registry.idl';

import { idlFactory as idlFactoryCertifiedClearing } from '$declarations/clearing/clearing.certified.idl';
import { idlFactory as idlFactoryCertifiedRegistry } from '$declarations/registry/registry.certified.idl';

import type { _SERVICE as ClearingService } from '$declarations/clearing/clearing';
import type { _SERVICE as RegistryService } from '$declarations/registry/registry';

export {
	idlFactoryCertifiedClearing,
	idlFactoryCertifiedRegistry,
	idlFactoryClearing,
	idlFactoryRegistry,
	type ClearingService,
	type RegistryService
};
