import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { Image } from "../../src/effect.js"
import { OpenRouter } from "../../src/providers.js"
import { dimensions } from "../lib/image.js"
import { recordedTests } from "../recorded-test.js"

const openrouter = OpenRouter.configure({ apiKey: process.env.OPENROUTER_API_KEY ?? "fixture" })

const recorded = recordedTests({
  prefix: "openrouter-images",
  provider: "openrouter",
  protocol: "openai-images",
  requires: ["OPENROUTER_API_KEY"],
})

// Replay matches the recorded request body, so these also pin `aspect_ratio` and `resolution` going out instead of a
// pixel `size`.
describe("OpenRouter Images recorded", () => {
  recorded.effect(
    "renders Gemini at the requested 2K tier",
    () =>
      Effect.gen(function* () {
        const response = yield* Image.generate({
          model: openrouter.image("google/gemini-3.1-flash-image"),
          prompt: "A simple flat black circle centered on a plain white background.",
          aspect: "16:9",
          resolution: "2K",
        })

        expect(dimensions(yield* response.image.bytes())).toEqual({ width: 2752, height: 1536 })
      }),
    { timeout: 120_000 },
  )

  recorded.effect(
    "renders FLUX 3 from an aspect ratio and tier",
    () =>
      Effect.gen(function* () {
        const response = yield* Image.generate({
          model: openrouter.image("black-forest-labs/flux-3-image-klein"),
          prompt: "A simple flat black circle centered on a plain white background.",
          aspect: "16:9",
          resolution: "1K",
        })

        expect(dimensions(yield* response.image.bytes())).toEqual({ width: 1360, height: 768 })
      }),
    { timeout: 120_000 },
  )
})
