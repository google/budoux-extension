# BudouX Chrome Extension

This extension applies the phrase-based line breaking
to the current page.

It uses the [BudouX] line breaking engine.
Please see the [BudouX] for more details of the engine.

<img src="https://raw.githubusercontent.com/google/budoux/main/example.png">

[BudouX]: https://github.com/google/budoux
# Setup the development environment

```sh
npm install
```

# Build

## Build the ZIP file

```sh
npm run zip
```

## Build the unpacked directory

```sh
npm run build
```

# Testing

## Unit tests

```sh
npm run test
```

## Browser tests

```sh
npm run dev
```
Then open [`test.html`] in the browser.

[`test.html`]: tests/test.html

## Unpacked extension tests

```sh
npm run build
```
Then install the extension using the following steps:
1. Start Chrome.
2. Open the Extension Management page by navigating to `chrome://extensions`.
3. Enable Developer Mode by clicking the toggle switch next to **Developer mode**.
4. Click the **Load unpacked** button and select the `dist` directory.

# Disclaimer

This is not an officially supported Google product.
