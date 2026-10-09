export const categories = [
  {
    key: 'algorithms',
    name: '算法',
    path: '/algorithms/',
    description: '数据结构、经典题型、复杂度分析与可迁移的解题方法。'
  },
  {
    key: 'agent',
    name: 'Agent',
    path: '/agent/',
    description: '模型、工具调用、上下文、记忆与智能体应用实践。'
  },
  {
    key: 'interviews',
    name: '面经',
    path: '/interviews/',
    description: '记录亲历的面试过程、真实问题、回答复盘与经验总结。'
  },
  {
    key: 'deployment',
    name: '部署',
    path: '/deployment/',
    description: 'Docker、CI/CD、云服务、环境配置与线上问题排查。'
  },
  {
    key: 'systems',
    name: '系统',
    path: '/systems/',
    description: '操作系统、计算机网络、Linux、并发与底层原理。'
  },
  {
    key: 'backend',
    name: '后端',
    path: '/backend/',
    description: 'Java、Spring、MySQL、Redis、消息队列与微服务。'
  }
]

export const categoryNames = categories.map((category) => category.name)
