import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// eslint-config-next（v16，npm 解析结果，peer 仅要求 eslint>=9）原生提供 flat preset：
// - core-web-vitals：react / react-hooks / jsx-a11y / import / @next/next 推荐规则，
//   globals 已合并 browser + node，故 scripts/*.mjs（Node 脚本）无需再单独声明 env；
// - typescript：typescript-eslint recommended（no-unused-vars / no-unused-expressions
//   已由 Next 官方降级为 warn），并内置忽略 .next/**、out/**、build/**、next-env.d.ts。
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'coverage/**',
      '**/.mimosa/**',
    ],
  },
  {
    rules: {
      // 挂载时拉取远程数据前同步 setLoading/setError 是 fetch-in-effect 的常规写法
      // （React 官方文档亦承认 effect 可用于与外部系统同步）；react-hooks v7 该规则
      // 对此场景报错过严，降级为 warn 保留可见性，待后续按新数据流范式统一重构。
      'react-hooks/set-state-in-effect': 'warn',
      // 解构剔除属性的惯用法（const { dropped, ...rest } = obj）不应计为未使用变量。
      '@typescript-eslint/no-unused-vars': ['warn', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
    },
  },
];

export default eslintConfig;
