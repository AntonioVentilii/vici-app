import { idlFactory as idlFactoryClearing } from '$declarations/clearing/clearing.idl';
import { idlFactory as idlFactoryManagement } from '$declarations/management/management.idl';
import { idlFactory as idlFactoryRegistry } from '$declarations/registry/registry.idl';

import { idlFactory as idlFactoryCertifiedClearing } from '$declarations/clearing/clearing.certified.idl';
import { idlFactory as idlFactoryCertifiedManagement } from '$declarations/management/management.certified.idl';
import { idlFactory as idlFactoryCertifiedRegistry } from '$declarations/registry/registry.certified.idl';

import type { _SERVICE as ClearingService } from '$declarations/clearing/clearing';
import type { _SERVICE as ManagementService } from '$declarations/management/management';
import type { _SERVICE as RegistryService } from '$declarations/registry/registry';

export {
	idlFactoryCertifiedClearing,
	idlFactoryCertifiedManagement,
	idlFactoryCertifiedRegistry,
	idlFactoryClearing,
	idlFactoryManagement,
	idlFactoryRegistry,
	type ClearingService,
	type ManagementService,
	type RegistryService
};
