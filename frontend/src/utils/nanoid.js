/** Tiny nanoid replacement — no dependency needed */
export function nanoid() {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
}
