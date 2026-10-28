import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { ImageSizing } from "../src/protocols/utils/image-sizing.js"
import { MediaProtocol } from "../src/route/media-protocol.js"

const route = MediaProtocol.identity({ id: "test-images", name: "Test Images", provider: "test" })
const TIERS = [
  { value: "512", tier: 0.5 },
  { value: "1K", tier: 1 },
  { value: "2K", tier: 2 },
]
const failure = <A>(effect: Effect.Effect<A, { readonly message: string }>) =>
  Effect.runSync(Effect.flip(effect)).message

const GPT_IMAGE_2 = { multiple: 16, maxEdge: 3840, minPixels: 655_360, maxPixels: 8_294_400, maxRatio: 3 }
const STANDARD = [
  { width: 1024, height: 1024 },
  { width: 1536, height: 1024 },
  { width: 1024, height: 1536 },
]

describe("ImageSizing", () => {
  test("fits an aspect ratio at a resolution tier", () => {
    expect(ImageSizing.fit({}, { multiple: 16 })).toEqual({ width: 1024, height: 1024 })
    expect(ImageSizing.fit({ aspect: "16:9" }, GPT_IMAGE_2)).toEqual({ width: 1360, height: 768 })
    expect(ImageSizing.fit({ aspect: "9:16", resolution: "2K" }, GPT_IMAGE_2)).toEqual({ width: 1536, height: 2736 })
    expect(ImageSizing.fit({ aspect: "1:1", resolution: "0.5K" }, { multiple: 16 })).toEqual({
      width: 512,
      height: 512,
    })
  })

  test("stays within the provider's limits", () => {
    expect(ImageSizing.fit({ aspect: "16:9", resolution: "4K" }, GPT_IMAGE_2)).toEqual({ width: 3840, height: 2160 })
    expect(ImageSizing.fit({ aspect: "1:1", resolution: "4K" }, GPT_IMAGE_2)).toEqual({ width: 2880, height: 2880 })
    expect(ImageSizing.fit({ aspect: "1:1", resolution: "0.5K" }, GPT_IMAGE_2)).toEqual({ width: 816, height: 816 })
    expect(ImageSizing.fit({ aspect: "4:1" }, GPT_IMAGE_2)).toEqual({ width: 1776, height: 592 })
    expect(ImageSizing.fit({ aspect: "16:9", resolution: "2K" }, { multiple: 16, maxPixels: 2048 * 2048 })).toEqual({
      width: 2720,
      height: 1536,
    })
    expect(ImageSizing.fit({ aspect: "16:9" }, { multiple: 32, minEdge: 1024, maxEdge: 2048 })).toEqual({
      width: 1824,
      height: 1024,
    })
  })

  test("picks the nearest listed size by aspect, then by pixel count", () => {
    expect(ImageSizing.nearest({ aspect: "16:9" }, STANDARD)).toEqual({ width: 1536, height: 1024 })
    expect(ImageSizing.nearest({ aspect: "3:4" }, STANDARD)).toEqual({ width: 1024, height: 1536 })
    expect(
      ImageSizing.nearest(
        { resolution: "0.5K" },
        [256, 512, 1024].map((edge) => ({ width: edge, height: edge })),
      ),
    ).toEqual({ width: 512, height: 512 })
  })

  test("keeps a provider's size only when it is close to the request", () => {
    expect(Effect.runSync(ImageSizing.accept(route, { aspect: "3:2" }, { width: 1536, height: 1024 }))).toEqual({
      width: 1536,
      height: 1024,
    })
    expect(Effect.runSync(ImageSizing.accept(route, {}, { width: 1024, height: 1024 }))).toBeUndefined()
    expect(
      failure(ImageSizing.accept(route, { aspect: "16:9", resolution: "2K" }, ImageSizing.nearest({}, STANDARD))),
    ).toStartWith("Test Images can't render 16:9 at 2K; the closest size it takes is 1024x1024 (1:1)")
    expect(Effect.runSync(ImageSizing.exact(route, { aspect: "16:9", resolution: "2K" }, GPT_IMAGE_2))).toEqual({
      width: 2736,
      height: 1536,
    })
  })

  test("sizes a fixed pixel count to the aspect", () => {
    expect(ImageSizing.atPixels({ aspect: "16:9" }, 2_480_000, 16)).toEqual({ width: 2096, height: 1184 })
    expect(ImageSizing.atPixels({ aspect: "9:16" }, 2_480_000, 16)).toEqual({ width: 1184, height: 2096 })
  })

  test("maps a resolution to the provider's nearest tier", () => {
    const resolution = (value: string) => Effect.runSync(ImageSizing.resolution(route, { resolution: value }, TIERS))
    expect(resolution("0.5K")).toBe("512")
    expect(resolution("512")).toBe("512")
    expect(resolution("2k")).toBe("2K")
    expect(resolution("1.5K")).toBe("2K")
    expect(Effect.runSync(ImageSizing.resolution(route, {}, TIERS))).toBeUndefined()
    expect(failure(ImageSizing.resolution(route, { resolution: "4K" }, TIERS))).toStartWith(
      "Test Images can't render 4K; the closest resolution it takes is 2K",
    )
    expect(failure(ImageSizing.resolution(route, { resolution: "huge" }, TIERS))).toBe(
      "Test Images can't render huge; it takes 512, 1K, 2K",
    )
  })
})
