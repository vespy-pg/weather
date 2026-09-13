# Promotion feed

Weather clients may display first-party promotions supplied by the Weather API. The same feed contract is shared by the web, Android, and iOS applications.

## Supported creative types

Only these creative types are allowed:

- `native-card` - the client renders a native layout from a logo, localized text, validated brand colors, and a target URL.
- `image-banner` - the client displays a complete raster creative with alternative text and a target URL.

Remote HTML, JavaScript, iframes, and WebView creatives are not allowed. The feed controls campaign content, while each client remains responsible for layout, accessibility, sizing, and interaction.

## Native card

A native card may contain:

- `id`
- `type`
- `title`
- `description`
- `actionLabel`
- `logoUrl`
- `targetUrl`
- `backgroundColor`
- `accentColor`
- `priority`

## Image banner

An image banner may contain:

- `id`
- `type`
- `imageUrl`
- `imageAlt`
- `targetUrl`
- `priority`

WebP is the preferred raster format. PNG is the fallback when lossless transparency is required. Animated GIF is not supported. SVG may be used only by clients that explicitly support and sanitize it.

## Delivery rules

- Assets and target URLs must use HTTPS in production.
- Clients must validate creative types, URLs, and colors before rendering.
- Text supplied by the feed must be rendered as text, never interpreted as markup.
- A client may cache the last valid feed for the duration specified by `cacheSeconds`.
- Failure to load or validate a promotion must not block weather data or leave an empty reserved area.
- Clients may rotate eligible campaigns using `rotationSeconds` and `priority`.
- Locale, platform, placement, and theme are targeting inputs, not permission to send executable content.
- Impression and click measurement may be added later without collecting precise location or weather-search history.

## Endpoint

```http
GET https://api.weather.vespy.eu/promotions?platform=web&placement=web_forecast&language=en&theme=dark
```

Supported placements are `web_forecast`, `forecast_landscape`, and `forecast_portrait`. The initial implementation serves a DINPanel native card. Additional campaigns and an administrative editor can be added without changing the client contract.

When analytics consent has been granted, the web client records `promotion_impression` once per campaign and page session, plus `promotion_click` for each click. Both events contain only `campaign_id`; they do not contain location or weather-search data.
