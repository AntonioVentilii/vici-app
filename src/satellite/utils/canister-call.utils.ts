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

const funcFor = ({
	idlFactory,
	method
}: {
	idlFactory: IdlFactory;
	method: string;
}): MethodDescription => {
	const field = idlFactory({ IDL })._fields.find(([name]) => name === method);

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
	const [retType] = funcFor({ idlFactory, method }).retTypes;

	if (retType === undefined) {
		throw new Error(`Method "${method}" does not return a value`);
	}

	return retType;
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
}): [IDL.Type, unknown][] =>
	funcFor({ idlFactory, method }).argTypes.map((type, index) => [type, values[index]]);
