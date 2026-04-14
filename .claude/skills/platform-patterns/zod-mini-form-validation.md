# Pattern: Zod Mini Form Validation

Form components define a module-level `zod/mini` schema, manage per-field state with `useState`, validate via `safeParse()` + `extractFieldErrors()`, and submit through `authClient` with `isSubmitting` gating.

## Rationale

`zod/mini` is used in `apps/web` (instead of full Zod) to keep bundle size down. The schema lives at module level (not inside the component) to avoid re-creation on each render. Validation and submission are split into separate `useCallback` functions to keep each concern testable. Field errors and server errors are tracked separately — field errors come from Zod issues, server errors come from the API response.

## Examples

### Example 1: LoginForm — schema + state setup
**File**: `apps/web/src/components/auth/login-form.tsx:13`
```typescript
import { z, email as zodEmail, minLength, safeParse } from "zod/mini";
import { extractFieldErrors } from "../../lib/form-utils.js";

const LOGIN_SCHEMA = z.object({
  email: zodEmail("Please enter a valid email address"),
  password: z.string().check(minLength(1, "Password is required")),
});

type LoginFields = z.infer<typeof LOGIN_SCHEMA>;
type FieldErrors = Partial<Record<"email" | "password", string>>;

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback((): LoginFields | null => {
    const result = safeParse(LOGIN_SCHEMA, { email, password });
    if (result.success) {
      setFieldErrors({});
      return result.data;
    }
    setFieldErrors(
      extractFieldErrors(result.error.issues, ["email", "password"]),
    );
    return null;
  }, [email, password]);
```

### Example 2: LoginForm — submit handler
**File**: `apps/web/src/components/auth/login-form.tsx:46`
```typescript
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setServerError("");

      const data = validate();
      if (!data) return;

      setIsSubmitting(true);
      try {
        const result = await authClient.signIn.email({
          email: data.email,
          password: data.password,
        });
        if (result.error) {
          setServerError(result.error.message ?? "Invalid email or password");
          return;
        }
        void navigate({ to: "/feed" });
      } catch {
        setServerError("Invalid email or password");
      } finally {
        setIsSubmitting(false);
      }
    },
    [validate, navigate],
  );
```

### Example 3: RegisterForm — same structure with additional field
**File**: `apps/web/src/components/auth/register-form.tsx:13`
```typescript
const REGISTER_SCHEMA = z.object({
  name: z.string().check(minLength(1, "Name is required")),
  email: zodEmail("Please enter a valid email address"),
  password: z.string().check(minLength(8, "Password must be at least 8 characters")),
});

type RegisterFields = z.infer<typeof REGISTER_SCHEMA>;
type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback((): RegisterFields | null => {
    const result = safeParse(REGISTER_SCHEMA, { name, email, password });
    if (result.success) {
      setFieldErrors({});
      return result.data;
    }
    setFieldErrors(
      extractFieldErrors(result.error.issues, ["name", "email", "password"]),
    );
    return null;
  }, [name, email, password]);
```

### Example 4: extractFieldErrors utility
**File**: `apps/web/src/lib/form-utils.ts:3`
```typescript
export function extractFieldErrors<K extends string>(
  issues: ReadonlyArray<{ path?: ReadonlyArray<PropertyKey>; message: string }>,
  validFields: readonly K[],
): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  for (const issue of issues) {
    const field = issue.path?.[0];
    if (validFields.includes(field as K)) {
      const key = field as K;
      errors[key] = errors[key] ?? issue.message; // first error wins
    }
  }
  return errors;
}
```

## When to Use

- Any form in `apps/web` that validates and submits user input
- Import `zod/mini` (not full `zod`) in web app forms for bundle size
- Always split validation into a `validate()` callback separate from `handleSubmit`

## When NOT to Use

- `packages/shared` or `apps/api` — use full `zod` there per AGENTS.md
- Read-only forms or forms without validation — skip Zod schema and `extractFieldErrors`
- Server-side validation only — don't duplicate server schema on the client just to add this pattern

## Common Violations

- Defining the schema inside the component function — recreated on every render
- Calling `validate()` inside the `useCallback` dep array — use `validate` as a dependency, not inline
- Using full `zod` in `apps/web` instead of `zod/mini` — increases bundle size
- Displaying raw Zod error messages to users — always provide human-readable messages in the schema
