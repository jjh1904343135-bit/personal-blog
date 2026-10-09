export const profile = {
  name: '俎嘉辉',
  alias: 'ok俎',
  role: 'AI Agent 与后端开发',
  intro: '把 Agent 的不确定性，做成可以评估、调试和持续迭代的工程系统。',
  email: '1904343135@qq.com',
  github: 'https://github.com/jjh1904343135-bit',
  education: [
    {
      school: '北京工业大学',
      degree: '计算机 · 硕士',
      period: '2025.09 — 2028.06（预计）',
      detail: 'DMS 实验室，研究方向包括分布式系统、区块链与信息安全。获研究生新生一等奖学金；投稿 CCF-A 类期刊 TIFS。'
    },
    {
      school: '内蒙古工业大学',
      degree: '网络工程 · 本科',
      period: '2021.09 — 2025.06',
      detail: '专业排名第 3，获国家奖学金、校级奖学金与优秀毕业生。'
    }
  ],
  experience: {
    company: '语势科技',
    role: 'Agent 应用开发实习生',
    period: '2026.06 — 2026.08',
    summary: '围绕工具调用、任务链路和上下文成本做工程化优化，让 Agent 的行为更可控、更高效。',
    metrics: [
      { value: '94.2%', label: '工具调用准确率', note: '由 78.6% 提升' },
      { value: '97s', label: '平均任务耗时', note: '由 142s 降低' },
      { value: '↓ 62.5%', label: '重复调用', note: '链路去重与状态约束' },
      { value: '↓ 34.6%', label: '输入 Token', note: '候选工具 48 → 6' }
    ]
  },
  projects: [
    {
      name: '青程 AI',
      type: 'Agent Runtime',
      period: '2026.03 — 2026.06',
      description: '面向复杂任务的 Agent 应用：打通工具调用、混合 RAG、评估、长期记忆与定时任务，让原型走向可运行系统。',
      stack: ['FastAPI', 'PostgreSQL', 'Redis', 'Qdrant', 'Next.js'],
      link: 'https://github.com/jjh1904343135-bit/intern-agent'
    },
    {
      name: '惠闪购',
      type: 'High Concurrency Backend',
      period: '2026.01 — 2026.03',
      description: '围绕缓存、异步消息、搜索与高并发场景设计的后端项目，关注稳定性、数据一致性和真实业务链路。',
      stack: ['Spring Boot', 'Redis', 'RabbitMQ', 'MySQL', 'Elasticsearch']
    }
  ],
  skills: [
    { title: 'Agent 工程', icon: '✦', items: ['Tool Calling', '工作流编排', '长期记忆', '任务调度', '可观测与调试'] },
    { title: 'RAG 与评估', icon: '◎', items: ['混合检索', '向量数据库', '上下文压缩', '效果评测', 'Prompt 迭代'] },
    { title: '工程栈', icon: '⌘', items: ['Java / Python', 'Spring Boot', 'FastAPI', 'MySQL / Redis', 'Docker / Linux'] }
  ]
}
