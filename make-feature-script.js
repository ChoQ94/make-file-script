#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

//  디렉토리 경로
const APP_DIR = path.join(__dirname, "../app");
const FEATURES_DIR = path.join(__dirname, "../features");

// page 템플릿
const templates = {
  page: (featureName, subFeature, viewComponentName, appRoute, hasSubFeature, baseFeatureName) => `
import { redirect } from 'next/navigation';
import WithAuth from '@/components/hoc/WithAuth';
import { createAuthHeader } from '@/lib/auth/useCase/createAuthHeader';
import { verifyAuth } from '@/lib/auth/useCase/verifyAuth';  
import ${viewComponentName} from '@/features/${featureName}${
    hasSubFeature ? `/${subFeature}` : ""
  }/${viewComponentName}';
import { PATH } from '@/lib/constant/entity';

interface Props {
  params: { [key: string]: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function ${toPascalCase(
    baseFeatureName
  )}Page({ params, searchParams }: Props) {
  const session = await verifyAuth();
  const header = createAuthHeader(session);
  if (!session) redirect(PATH.expiration);

  return (
    <WithAuth session={session}>
      <${viewComponentName} />
    </WithAuth>
  );
}
`,

  // View 컴포넌트 템플릿
  view: (viewComponentName, hookName) => `'use client';

import Page from '@/components/core/Layout/Page';
import { ${hookName} } from './hooks/${hookName}';

interface ${viewComponentName}Props {
  
}

function ${viewComponentName}(props: ${viewComponentName}Props) {
  const {} = ${hookName}();

  return (
    <Page
      className="p-6"
    >
      <></>
    </Page>
  );
}

export default ${viewComponentName};
`,

  // 훅 템플릿
  hook: (hookName, viewComponentName) => `


export const ${hookName} = () => {
  return {};
};
`,
};

/**
 * 🛠️ 유틸리티 함수들
 */
function toPascalCase(str) {
  return (
    str
      // camelCase나 PascalCase에서 대문자 앞에 공백 추가 (userProfile → user Profile)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // 하이픈, 언더스코어를 공백으로 변환
      .replace(/[-_]/g, " ")
      // 공백으로 분리하고 각 단어를 대문자로 시작
      .split(" ")
      .filter((word) => word.length > 0) // 빈 문자열 제거
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("")
  );
}

function toCamelCase(str) {
  const pascal = toPascalCase(str);
  return pascal[0].toLowerCase() + pascal.slice(1);
}

// 디렉토리 생성
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📂 디렉토리 생성: ${dirPath}`);
  }
}

// 파일 작성
function writeFile(filePath, content) {
  if (fs.existsSync(filePath)) {
    console.log(`⚠️  파일이 이미 존재합니다: ${filePath}`);
    return false;
  }

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`✅ 파일 생성: ${filePath}`);
  return true;
}

// 라우트 경로를 파싱하여 feature 정보 추출
function parseRoute(routePath) {
  // 라우트 경로에서 동적 세그먼트 제거하고 파싱
  const cleanPath = routePath.replace(/\[[\w-]+\]/g, "dynamic");
  const segments = cleanPath.split("/").filter(Boolean);

  if (segments.length === 0) {
    return {
      featureName: "home",
      subFeature: null,
      hasSubFeature: false,
    };
  }

  if (segments.length === 1) {
    // 단일 경로: user-profile → userProfile (단일 폴더)
    const featureName = toCamelCase(segments[0]);
    return {
      featureName,
      subFeature: null,
      hasSubFeature: false,
    };
  }

  // 복합 경로 처리 (예: user/profile)
  const featureName = toCamelCase(segments[0]);
  const subFeatureParts = segments.slice(1);
  const subFeature = toCamelCase(segments.join("_"));

  return {
    featureName,
    subFeature,
    hasSubFeature: true,
  };
}

// 메인 생성 함수
function generateFeature(routePath, options = {}) {
  console.log(`\nFeature 생성을 시작합니다: ${routePath}\n`);

  const { featureName, subFeature, hasSubFeature } = parseRoute(routePath);

  // 컴포넌트 이름 결정
  const baseFeatureName = subFeature || featureName;
  const viewComponentName = `${toPascalCase(baseFeatureName)}View`;
  const hookName = `use${toPascalCase(baseFeatureName)}Logic`;

  // 1. 📂 App 페이지 생성
  const appRoutePath = path.join(APP_DIR, routePath);
  ensureDir(appRoutePath);
  writeFile(
    path.join(appRoutePath, "page.tsx"),
    templates.page(
      featureName,
      subFeature,
      viewComponentName,
      routePath,
      hasSubFeature,
      baseFeatureName
    )
  );

  // 2. 📂 Feature 디렉토리 생성
  const featurePath = path.join(FEATURES_DIR, featureName);
  let targetPath;

  if (hasSubFeature) {
    // 세부 폴더 생성: features/userProfile/userInfo/
    targetPath = path.join(featurePath, subFeature);
    ensureDir(targetPath);
  } else {
    // 단일 폴더: features/userProfile/
    targetPath = featurePath;
    ensureDir(targetPath);
  }

  ensureDir(path.join(targetPath, "hooks"));

  // 3. 📄 메인 파일들 생성
  writeFile(
    path.join(targetPath, `${viewComponentName}.tsx`),
    templates.view(viewComponentName, hookName)
  );

  writeFile(
    path.join(targetPath, "hooks", `${hookName}.ts`),
    templates.hook(hookName, viewComponentName)
  );

  console.log(`\n Feature 생성 완료!\n`);

  // 4. 📋 생성된 파일 목록 출력
  console.log(`생성된 구조:`);
  console.log(`app/`);
  console.log(`└── ${routePath}/`);
  console.log(`    └── page.tsx`);
  console.log(`features/`);
  console.log(`└── ${featureName}/`);

  if (hasSubFeature) {
    console.log(`    └── ${subFeature}/`);
    console.log(`        ├── ${viewComponentName}.tsx`);
    console.log(`        └── hooks/`);
    console.log(`            └── ${hookName}.ts`);
  } else {
    console.log(`    ├── ${viewComponentName}.tsx`);
    console.log(`    └── hooks/`);
    console.log(`        └── ${hookName}.ts`);
  }
}

/**
 * 📋 도움말 출력
 */
function showHelp() {
  console.log(`
Feature & Page 보일러플레이트 자동 생성 도구

사용법:
  node scripts/make-feature.js <route-path> [options]
  pnpm make <route-path> [options]

예시:
  pnpm make user-profile                 # 단일 폴더: features/userProfile/
  pnpm make user/profile                 # 세부 폴더: features/user/userProfile/

옵션:
  --help         도움말 표시

팁: 경로에 '/'를 사용하면 자동으로 세부 폴더가 생성됩니다!

생성되는 구조:

단일 폴더 방식 (기본):
  app/user-profile/page.tsx
  features/userProfile/
  ├── UserProfileView.tsx
  └── hooks/useUserProfileLogic.ts

세부 폴더 방식 (복합 경로):
  app/user/profile/page.tsx  
  features/user/
  └── userProfile/
      ├── UserProfileView.tsx
      └── hooks/useUserProfileLogic.ts
`);
}

// 실행 함수
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    showHelp();
    return;
  }

  const routePath = args[0];
  const options = {};

  try {
    generateFeature(routePath, options);
  } catch (error) {
    console.error("생성 중 오류 발생:", error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = { generateFeature };
