# Svelte 5 Patterns

- **Idiomatic Code**: Always follow Svelte 5 best practices and patterns.
- **Runes**: Use for all state management: `$state`, `$derived`, `$effect`.
- **Props Syntax**: Use destructuring with types:
  ```typescript
  const { prop1, prop2 = defaultValue }: Props = $props();
  ```
- **Interface Declaration**: Declare the `Props` interface directly within the `.svelte` file for better encapsualtion and visibility.
- **Two-way Binding**: Avoid `$bindable` unless explicitly required.
