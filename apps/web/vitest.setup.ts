// lib/env.ts validates NEXT_PUBLIC_* variables eagerly at import time, so
// any test that (even transitively) imports it needs these set first.
// Values are dummies -- no test in this workspace makes real network calls.
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_API_URL ??= 'http://localhost:8080';
process.env.NEXT_PUBLIC_GENLAYER_NETWORK ??= 'studionet';
process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ??= 'http://localhost:4000/api';
