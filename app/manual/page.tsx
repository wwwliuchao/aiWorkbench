import type { Metadata } from "next";
import { withBasePath } from "@/lib/public-path";

export const metadata: Metadata = {
  title: "项目说明",
  description: "华徽AI工作台使用说明"
};

const featureSections = [
  {
    title: "1. 首页工作台",
    description: "首页是系统默认进入页面，适合日常快速找应用、按类型浏览入口，以及查看常用推荐。",
    bullets: [
      "页面顶部会显示当前登录用户信息、说明书入口和退出登录按钮。",
      "中间的资产类型卡片可用于按类型筛选，例如飞书多维表、Dify 工作流等。",
      "下方“全部应用”列表会展示当前可访问的应用入口，并支持关键词搜索。",
      "右侧“应用推荐”区域适合快速打开常用系统，也可以直接加入收藏。"
    ],
    steps: [
      "先在首页浏览全部应用，确认是否已经能直接找到目标入口。",
      "如果应用较多，先点击类型筛选，再使用搜索框缩小范围。",
      "常用入口建议点星标加入“我的收藏”，后续访问更快。"
    ]
  },
  {
    title: "2. 左侧目录浏览",
    description: "左侧目录树按照业务文件夹组织应用，适合按部门、流程或业务主题查找系统入口。",
    bullets: [
      "点击目录名称后，右侧会展示当前目录以及其子目录下的全部应用。",
      "目录支持多级结构，若某个目录前面有展开箭头，说明该目录下面还有子目录。",
      "进入目录页后，页面会显示当前目录下的应用数量，便于快速判断内容规模。",
      "如果当前目录没有可显示应用，页面会提示“暂无应用”。"
    ],
    steps: [
      "先从左侧树形目录找到你所在业务线或目标系统分类。",
      "若目录层级较深，可先展开父级目录，再点击子目录查看。",
      "进入目录页后，可继续结合类型筛选和搜索框做二次过滤。"
    ]
  },
  {
    title: "3. 搜索与筛选",
    description: "系统内多数应用列表都支持搜索或筛选，适合在应用数量较多时快速定位目标。",
    bullets: [
      "首页和目录页的搜索框支持按名称、说明、负责人、部门、标签搜索。",
      "统计页支持按日期范围和应用类型筛选数据。",
      "RPA 页面支持按任务名称、部门和状态筛选任务。",
      "类型筛选适合做大范围缩小，关键词搜索适合做精准定位。"
    ],
    steps: [
      "先用左侧目录或顶部类型卡片确定大类。",
      "再输入关键词查找更精确的目标应用。",
      "若没有结果，建议尝试换一个业务词、负责人名字或标签关键字。"
    ]
  },
  {
    title: "4. 我的收藏",
    description: "“我的收藏”用于沉淀个人常用入口，适合减少重复查找，提高日常访问效率。",
    bullets: [
      "在应用列表、统计排行、应用推荐等位置，应用名称旁边会显示星标按钮。",
      "点击空心星标可加入收藏，点击实心星标可取消收藏。",
      "左侧固定有“我的收藏”入口，进入后会只显示当前用户已收藏的应用。",
      "收藏数据现在保存在后端收藏表中，不再依赖浏览器本地缓存。"
    ],
    steps: [
      "把每天高频打开的入口先收藏起来。",
      "进入“我的收藏”页后，可直接搜索或按类型继续筛选收藏内容。",
      "如果某个入口不再常用，直接取消收藏即可。"
    ]
  },
  {
    title: "5. 统计报表",
    description: "统计报表用于查看应用访问情况，适合做使用分析、热点应用识别和阶段性复盘。",
    bullets: [
      "页面支持按开始日期、结束日期和应用类型做筛选。",
      "可查看总访问数、今日访问、近 7 天访问、近 30 天访问等指标。",
      "支持查看应用访问排行、部门访问排行、用户访问排行和近 14 天趋势。",
      "点击排行中的应用名称，仍可直接打开原始系统入口。"
    ],
    steps: [
      "想看整体情况时，不设置筛选条件，直接看默认统计。",
      "想看阶段使用情况时，设置日期范围后查看区间访问数据。",
      "想看某一类应用效果时，增加应用类型筛选。"
    ]
  },
  {
    title: "6. 实在 RPA",
    description: "RPA 页面用于查看自动化任务、启动任务以及追踪运行记录，适合运营、信息化或流程维护人员使用。",
    bullets: [
      "页面顶部可以按任务名称、部门、状态筛选任务。",
      "任务列表显示任务名称、部门、需求文档、状态、更新时间等信息。",
      "点击“启动程序”会调用后端接口触发对应 RPA 任务启动。",
      "点击“日志”可查看该任务对应的运行记录，包括状态、开始时间、结束时间和操作人。"
    ],
    steps: [
      "先通过筛选找到目标任务。",
      "启动前建议先查看需求文档，确认用途和触发条件。",
      "启动后如需核对执行情况，可进入日志页查看最新记录。"
    ]
  },
  {
    title: "7. 管理后台（管理员）",
    description: "管理后台仅管理员可见，用于维护目录、资产类型、应用入口以及部分 RPA 配置。",
    bullets: [
      "可维护目录结构，包括新增目录、设置父级目录、调整排序和启停状态。",
      "可维护资产类型，用于定义前台展示的类型标签、颜色和图标。",
      "可维护应用入口，包括名称、说明、负责人、部门、链接、标签等字段。",
      "可维护 RPA 任务的需求文档地址，便于业务用户查看任务说明。"
    ],
    steps: [
      "新增目录前，先确定业务分类和层级关系。",
      "新增应用时，尽量补齐说明、负责人和标签，方便后续搜索。",
      "停用目录或应用前，先确认是否仍有业务人员在使用。"
    ]
  }
];

const faqItems = [
  {
    question: "为什么有些目录里显示暂无应用？",
    answer: "说明当前目录及其子目录下没有可展示的 active 状态应用，或者相关数据还没有维护完成。"
  },
  {
    question: "为什么我看不到管理后台？",
    answer: "管理后台只对管理员显示。普通用户登录后不会看到该入口。"
  },
  {
    question: "为什么收藏在不同电脑上要重新登录后才同步？",
    answer: "因为收藏现在走后端收藏表，登录后会按当前用户身份从服务端读取收藏数据。"
  },
  {
    question: "为什么点击应用后没有内容或跳转异常？",
    answer: "通常是目标系统本身地址失效、权限不足，或应用链接配置不正确。可联系管理员核查资产链接。"
  }
];

export default function ManualPage() {
  return (
    <main className="manualShell">
      <section className="manualHero">
        <div>
          <span className="manualEyebrow">使用说明</span>
          <h1>华徽AI工作台说明书</h1>
          <p>
            这份说明面向系统使用者和管理员，帮助你快速了解系统能做什么、每个页面怎么用，以及日常使用时的推荐操作方式。
          </p>
        </div>
        <div className="manualHeroActions">
          <a className="manualLinkButton" href={withBasePath("/")}>
            返回首页
          </a>
        </div>
      </section>

      <section className="manualGuideGrid">
        <article className="manualCard">
          <h2>快速上手</h2>
          <ol className="manualSteps">
            <li>登录后先进入首页，熟悉类型筛选、搜索框和应用列表。</li>
            <li>如果需要按业务分类找应用，优先使用左侧目录树。</li>
            <li>把高频入口加入“我的收藏”，后续可直接从收藏区访问。</li>
            <li>需要看使用情况时，进入“统计报表”；需要跑自动化任务时，进入“实在RPA”。</li>
            <li>如果你是管理员，再进入“管理后台”做目录、应用和类型维护。</li>
          </ol>
        </article>

        <article className="manualCard">
          <h2>适合谁用</h2>
          <div className="manualTags">
            <span>普通业务用户</span>
            <span>部门负责人</span>
            <span>流程运营人员</span>
            <span>RPA 使用者</span>
            <span>系统管理员</span>
          </div>
          <p className="manualCardText">
            如果你的目标是“快速找到系统入口”，重点看首页、目录和收藏；如果你的目标是“维护系统内容”，重点看管理后台。
          </p>
        </article>
      </section>

      <section className="manualSections">
        {featureSections.map((section) => (
          <article className="manualSectionCard" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.description}</p>

            <h3>主要功能</h3>
            <ul className="manualBulletList">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3>推荐操作</h3>
            <ol className="manualSteps compact">
              {section.steps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </article>
        ))}
      </section>

      <section className="manualFaqSection">
        <article className="manualCard">
          <h2>常见问题</h2>
          <div className="manualFaqList">
            {faqItems.map((item) => (
              <div className="manualFaqItem" key={item.question}>
                <strong>{item.question}</strong>
                <p>{item.answer}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
