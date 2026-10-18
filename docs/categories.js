export const categories = [
  {
    key: 'algorithms',
    name: '算法',
    path: '/algorithms/',
    image: '/images/topics/algorithms.webp',
    imageAlt: '戴银框眼镜的卡通男孩在双显示器前编程，周围漂浮着算法树和数据方块',
    description: '数据结构、经典题型、复杂度分析与可迁移的解题方法。'
  },
  {
    key: 'agent',
    name: 'Agent',
    path: '/agent/',
    image: '/images/topics/agent.webp',
    imageAlt: '戴银框眼镜的卡通男孩在科技工作台上组装 AI 机器人和发光大脑',
    description: '模型、工具调用、上下文、记忆与智能体应用实践。'
  },
  {
    key: 'interviews',
    name: '面经',
    path: '/interviews/',
    image: '/images/topics/interviews.webp',
    imageAlt: '穿西装的卡通男孩拿着写字板，在麦克风前进行面试模拟',
    description: '记录亲历的面试过程、真实问题、回答复盘与经验总结。'
  },
  {
    key: 'deployment',
    name: '部署',
    path: '/deployment/',
    image: '/images/topics/deployment.webp',
    imageAlt: '卡通男孩在微缩流水线上搬运并堆叠发光的服务器模块',
    description: 'Docker、CI/CD、云服务、环境配置与线上问题排查。'
  },
  {
    key: 'systems',
    name: '系统',
    path: '/systems/',
    image: '/images/topics/systems.webp',
    imageAlt: '戴手套的卡通男孩把彩色光纤连接到发光的服务器机柜',
    description: '操作系统、计算机网络、Linux、并发与底层原理。'
  },
  {
    key: 'backend',
    name: '后端',
    path: '/backend/',
    image: '/images/topics/backend.webp',
    imageAlt: '卡通男孩躺在橙色沙发上看手机，周围是数据库、缓存与消息模块',
    description: 'Java、Spring、MySQL、Redis、消息队列与微服务。'
  }
]

export const categoryNames = categories.map((category) => category.name)
