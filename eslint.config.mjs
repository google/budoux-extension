import babelParser from "@babel/eslint-parser";
import globals from "globals";
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    ignores: ["**/bundle", "**/dist", "**/module", "src/data"],
  },
  js.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jasmine,
        chrome: "readonly",
      },
    },
    rules: {
      "block-scoped-var": "error",
      eqeqeq: "error",
      "no-var": "error",
      "prefer-const": "error",
      "eol-last": "error",
      "prefer-arrow-callback": "error",
      "no-trailing-spaces": "error",

      quotes: ["warn", "single", {
        avoidEscape: true,
      }],

      "no-restricted-properties": ["error", {
        object: "describe",
        property: "only",
      }, {
        object: "it",
        property: "only",
      }],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],

    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-typescript"],
        },
      },
      ecmaVersion: 2018,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jasmine,
        chrome: "readonly",
      },
    },

    rules: {
      "no-unused-vars": "off",
      "no-dupe-class-members": "off",
      "require-atomic-updates": "off",
    },
  },
];