import { IDL } from '@icp-sdk/core/candid';

/**
 * Runtime Candid IDL for cross-canister `call()`s is sourced **only** from the
 * generated declaration factories (`idlFactoryClearing` / `idlFactoryRegistry`
 * from `$declarations`) — never hand-written in a service file. A hand-rolled
 * IDL value can silently drift from the canister's `*.did`; deriving it from
 * the same factory the codegen emits keeps the wire shape in lock-step with the
 * interface by construction.
 *
 * Each generated factory is a function that returns the canister's service
 * description. These helpers look the method up in that service's `_fields` and
 * project its generated argument / return types into the shape Juno's `call()`
 * expects.
 */

// `ServiceClass` / `FuncClass` are only reachable through the `IDL` namespace;
// indexing `typeof IDL` references them without depending on a standalone named
// export.
type ServiceDescription = InstanceType<(typeof IDL)['ServiceClass']>;
type MethodDescription = InstanceType<(typeof IDL)['FuncClass']>;

type IdlFactory = (args: { IDL: typeof IDL }) => ServiceDescription;

// Building the service description walks the entire generated IDL graph. The
// result is immutable for a given factory, so memoise it per factory: a single
// cross-canister call typically asks for both `callArgs` and `callResultType`,
// and without the cache each would rebuild the whole graph.
const serviceCache = new WeakMap<IdlFactory, ServiceDescription>();

const serviceFor = (idlFactory: IdlFactory): ServiceDescription => {
	const cached = serviceCache.get(idlFactory);

	if (cached !== undefined) {
		return cached;
	}

	const service = idlFactory({ IDL });
	serviceCache.set(idlFactory, service);

	return service;
};

const funcFor = ({
	idlFactory,
	method
}: {
	idlFactory: IdlFactory;
	method: string;
}): MethodDescription => {
	const field = serviceFor(idlFactory)._fields.find(([name]) => name === method);

	if (field === undefined) {
		throw new Error(`Method "${method}" is not part of the canister interface`);
	}

	return field[1];
};

/** Decode type for a single-value-returning method, taken from the generated IDL. */
export const callResultType = ({
	idlFactory,
	method
}: {
	idlFactory: IdlFactory;
	method: string;
}): IDL.Type => {
	const { retTypes } = funcFor({ idlFactory, method });

	if (retTypes.length !== 1) {
		throw new Error(
			`Method "${method}" must return exactly one value to decode (interface declares ${retTypes.length})`
		);
	}

	return retTypes[0];
};

/** Pairs each generated arg type with its caller-supplied value for `call({ args })`. */
export const callArgs = ({
	idlFactory,
	method,
	values
}: {
	idlFactory: IdlFactory;
	method: string;
	values: readonly unknown[];
}): [IDL.Type, unknown][] => {
	const { argTypes } = funcFor({ idlFactory, method });

	if (values.length !== argTypes.length) {
		throw new Error(
			`Method "${method}" expects ${argTypes.length} argument(s), received ${values.length}`
		);
	}

	return argTypes.map((type, index) => [type, values[index]]);
};
