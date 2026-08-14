// Type-only: brings @testing-library/jest-dom's matcher augmentation
// (toBeInTheDocument, toHaveAttribute, ...) into vitest's `Assertion`
// interface for `tsc -b` (tsconfig.app.json), which compiles `src/**` as
// its own program and doesn't see vitest.setup.ts's runtime import (that
// file lives under tsconfig.node.json instead).
import '@testing-library/jest-dom/vitest'
