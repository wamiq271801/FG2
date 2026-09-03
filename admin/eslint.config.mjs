import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "react/no-unescaped-entities": "off",
    "@next/next/no-img-element": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "next-env.d.ts"],
}];

export default eslintConfig;
