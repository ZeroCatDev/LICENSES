import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join } from "path";
import { load } from "js-yaml";
import chalk from "chalk";
import { GoogleTranslator } from "@translate-tools/core/translators/GoogleTranslator/index.js";

const translator = new GoogleTranslator({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36",
  },
});

// 读取指定目录下的所有文件
const licensesDir = join(process.cwd(), "./choosealicense.com/_licenses");
const dataDir = join(process.cwd(), "./choosealicense.com/_data");
const outputDir = join(process.cwd(), "./data/en");
const languages = ["zh-cn"];
const files = readdirSync(licensesDir);
const dataFiles = ["rules.yml", "fields.yml", "meta.yml"];

// 创建输出目录
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

let licenses = {};
let licensesFull = {};

console.log(chalk.blue("开始读取许可证文件..."));

files.forEach((file) => {
  const filePath = join(licensesDir, file);
  const data = readFileSync(filePath, "utf8");

  // 使用 yaml 解析文件内容
  const [yamlPart, body] = data.split("---").filter(Boolean);
  const license = load(yamlPart.trim());

  // 添加到完整数据中
  licensesFull[license["spdx-id"].toLowerCase()] = {
    title: license.title,
    "spdx-id": license["spdx-id"],
    featured: license.featured,
    hidden: license.hidden !== undefined ? license.hidden : true, // 默认视为 hidden: true
    description: license.description,
    how: license.how,
    permissions: license.permissions,
    conditions: license.conditions,
    limitations: license.limitations,
    body: body.trim(),
  };

  // 只包含 hidden: false 的项目
  if (license.hidden === false) {
    licenses[license["spdx-id"].toLowerCase()] =
      licensesFull[license["spdx-id"].toLowerCase()];
    console.log(chalk.green(`已处理: ${license.title}`));
  } else {
    console.log(chalk.yellow(`跳过隐藏许可证: ${license.title}`));
  }
});

// 将结果存储为 licenses.json 文件
writeFileSync(
  join(outputDir, "licenses.json"),
  JSON.stringify(licenses, null, 2)
);
console.log(chalk.blue("许可证文件已生成: licenses.json"));

// 将完整数据存储为 licenses-full.json 文件
writeFileSync(
  join(outputDir, "licenses-full.json"),
  JSON.stringify(licensesFull, null, 2)
);
console.log(chalk.blue("完整许可证文件已生成: licenses-full.json"));

// 处理 _data 目录中的 yml 文件
dataFiles.forEach((file) => {
  const filePath = join(dataDir, file);
  if (existsSync(filePath)) {
    const data = readFileSync(filePath, "utf8");
    const jsonData = load(data);

    let formattedData;
    if (file === "rules.yml") {
      formattedData = {
        permissions: {},
        conditions: {},
        limitations: {},
      };
      jsonData.permissions.forEach((item) => {
        formattedData.permissions[item.tag] = {
          label: item.label,
          description: item.description,
        };
      });
      jsonData.conditions.forEach((item) => {
        formattedData.conditions[item.tag] = {
          label: item.label,
          description: item.description,
        };
      });
      jsonData.limitations.forEach((item) => {
        formattedData.limitations[item.tag] = {
          label: item.label,
          description: item.description,
        };
      });
    } else if (file === "fields.yml") {
      formattedData = {};
      jsonData.forEach((item) => {
        formattedData[item.name] = item.description;
      });
    } else if (file === "meta.yml") {
      formattedData = {};
      Object.keys(jsonData).forEach((key) => {
        formattedData[jsonData[key].name] = {
          description: jsonData[key].description,
          required: jsonData[key].required,
        };
      });
    }

    const jsonFileName = file.replace(".yml", ".json");
    writeFileSync(
      join(outputDir, jsonFileName),
      JSON.stringify(formattedData, null, 2)
    );
    console.log(chalk.blue(`${jsonFileName} 文件已生成`));

    // 翻译并存储
    languages.forEach(async (lang) => {
      console.log(chalk.blue(`开始翻译 ${file} 到 ${lang}...`));
      const translatedData = JSON.parse(JSON.stringify(formattedData));
      if (file === "rules.yml") {
        for (const key in translatedData.permissions) {
          translatedData.permissions[key].label = await translator.translate(
            translatedData.permissions[key].label,
            "en",
            lang
          );
          translatedData.permissions[key].description =
            await translator.translate(
              translatedData.permissions[key].description,
              "en",
              lang
            );
        }
        for (const key in translatedData.conditions) {
          translatedData.conditions[key].label = await translator.translate(
            translatedData.conditions[key].label,
            "en",
            lang
          );
          translatedData.conditions[key].description =
            await translator.translate(
              translatedData.conditions[key].description,
              "en",
              lang
            );
        }
        for (const key in translatedData.limitations) {
          translatedData.limitations[key].label = await translator.translate(
            translatedData.limitations[key].label,
            "en",
            lang
          );
          translatedData.limitations[key].description =
            await translator.translate(
              translatedData.limitations[key].description,
              "en",
              lang
            );
        }
      } else if (file === "fields.yml") {
        for (const key in translatedData) {
          translatedData[key] = await translator.translate(
            translatedData[key],
            "en",
            lang
          );
        }
      } else if (file === "meta.yml") {
        for (const key in translatedData) {
          translatedData[key].description = await translator.translate(
            translatedData[key].description,
            "en",
            lang
          );
        }
      }

      const langOutputDir = join(process.cwd(), `./data/${lang}`);
      if (!existsSync(langOutputDir)) {
        mkdirSync(langOutputDir, { recursive: true });
      }
      writeFileSync(
        join(langOutputDir, jsonFileName),
        JSON.stringify(translatedData, null, 2)
      );
      console.log(chalk.blue(`${jsonFileName} 文件已生成到 ${lang} 文件夹`));
    });
  } else {
    console.log(chalk.red(`文件不存在: ${filePath}`));
  }
});

// 翻译 licenses 和 licenses-full
languages.forEach(async (lang) => {
  console.log(chalk.blue(`开始翻译 licenses 和 licenses-full 到 ${lang}...`));
  const translatedLicenses = JSON.parse(JSON.stringify(licenses));
  const translatedLicensesFull = JSON.parse(JSON.stringify(licensesFull));

  for (const key in translatedLicenses) {
    translatedLicenses[key].description = await translator.translate(
      translatedLicenses[key].description,
      "en",
      lang
    );
    translatedLicenses[key].how = await translator.translate(
      translatedLicenses[key].how,
      "en",
      lang
    );
  }

  for (const key in translatedLicensesFull) {
    translatedLicensesFull[key].description = await translator.translate(
      translatedLicensesFull[key].description,
      "en",
      lang
    );
    translatedLicensesFull[key].how = await translator.translate(
      translatedLicensesFull[key].how,
      "en",
      lang
    );
  }

  const langOutputDir = join(process.cwd(), `./data/${lang}`);
  if (!existsSync(langOutputDir)) {
    mkdirSync(langOutputDir, { recursive: true });
  }
  writeFileSync(
    join(langOutputDir, "licenses.json"),
    JSON.stringify(translatedLicenses, null, 2)
  );
  writeFileSync(
    join(langOutputDir, "licenses-full.json"),
    JSON.stringify(translatedLicensesFull, null, 2)
  );
  console.log(
    chalk.blue(
      `licenses.json 和 licenses-full.json 文件已生成到 ${lang} 文件夹`
    )
  );
});
