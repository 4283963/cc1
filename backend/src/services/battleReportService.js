const UserWatchHistory = require('../models/UserWatchHistory');
const PersonalityService = require('./personalityService');
const pool = require('../db/mysql');

const COMMENTS = {
  brave: [
    '你是吃了熊心豹子胆吗？',
    '勇敢牛牛，不怕困难！',
    '莽夫一个，但我喜欢。',
    '生死有命，富贵在天，说的就是你。',
  ],
  cowardly: [
    '苟住，我们能赢！',
    '怂是人类进步的阶梯。',
    '你这也太能苟了吧...',
    '活着才有输出，没毛病。',
  ],
  violent: [
    '暴力不能解决问题，但能解决你。',
    '社会我哥，人狠话不多。',
    '建议你出门左转看心理医生。',
    '能动手就别逼逼，是你吧？',
  ],
  peaceful: [
    '世界和平靠你了。',
    '这就是传说中的佛系玩家？',
    '温柔刀，刀刀致命。',
    '和平大使非你莫属。',
  ],
  smart: [
    '就你这智商，基本告别自行车了。（不是）',
    '柯南看了都要喊你一声大哥。',
    '智商碾压，但为什么还在看短剧？',
    '建议直接去最强大脑报名。',
  ],
  reckless: [
    '你是凭实力作死的。',
    '冲动是魔鬼，但你是魔鬼本人。',
    '无脑冲就完事了？',
    '阎王：这人怎么天天来报到？',
  ],
  cautious: [
    '小心驶得万年船，说的就是你。',
    '苟道中人，失敬失敬。',
    '你这谨慎程度，适合去当保安。',
    '稳如老狗，说的就是你吧？',
  ],
  curious: [
    '好奇害死猫，但你不是猫。',
    '你的好奇心能养活十个侦探。',
    '什么都想看看，迟早要出事。',
    '探索家转世，鉴定完毕。',
  ],
};

const ENDING_COMMENTS = {
  good: [
    '恭喜通关！你就是天选之子！',
    '完美结局，这波操作我给满分。',
    '人生赢家说的就是你吧？',
    '撒花~可喜可贺可喜可贺。',
  ],
  bad: [
    '呃...这结局有点惨啊。',
    '事实证明，不作死就不会死。',
    '你是我带过最差的一届玩家。',
    '再来一次？我赌五毛你还是死。',
  ],
  neutral: [
    '普普通通的结局，普普通通的你。',
    '就这？就这？就这？',
    '不上不下，不咸不淡。',
    '还行吧，凑合过呗，还能离咋地。',
  ],
};

function pickRandom(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

class BattleReportService {
  static async generateReport(userId, seriesId) {
    const history = await UserWatchHistory.getUserHistory(userId, seriesId);
    const personality = await PersonalityService.getUserPersonality(userId, seriesId);
    const series = await this._getSeriesInfo(seriesId);
    const allNodes = await this._getAllNodes(seriesId);
    
    if (!history || history.length === 0) {
      return {
        user_id: userId,
        series_id: seriesId,
        series_title: series?.title || '未知剧集',
        error: 'no_history',
      };
    }

    const path = history.history || [];
    const endingNode = path[path.length - 1];
    const isEnding = endingNode?.is_ending || false;
    const endingType = endingNode?.ending_type || 'neutral';
    
    const totalNodes = allNodes.length;
    const viewedCount = history.viewed_node_ids?.length || path.length;
    const completionRate = totalNodes > 0 ? Math.round((viewedCount / totalNodes) * 100) : 0;
    
    const keyDecisions = await this._extractKeyDecisions(path, seriesId);
    
    const personalitySummary = this._generatePersonalitySummary(personality);
    
    const overallComment = this._generateOverallComment(
      isEnding, endingType, personality, path.length
    );
    
    const title = this._generateTitle(personality, endingType);
    
    return {
      user_id: userId,
      series_id: seriesId,
      series_title: series?.title || '',
      title,
      overall_comment: overallComment,
      is_ending: isEnding,
      ending_type: endingType,
      ending_title: endingNode?.node_title || '',
      
      stats: {
        total_nodes: totalNodes,
        viewed_nodes: viewedCount,
        completion_rate: completionRate,
        path_length: path.length,
        total_choices: personality.total_choices || 0,
      },
      
      path: path.map((h, idx) => ({
        index: idx + 1,
        node_id: h.node_id,
        title: h.node_title,
        watch_time: h.watch_duration || 0,
        is_ending: idx === path.length - 1 && isEnding,
      })),
      
      key_decisions: keyDecisions,
      
      personality: {
        dominant_trait: personality.dominant_trait,
        dominant_color: personality.dominant_color,
        traits: personality.traits || [],
        summary: personalitySummary,
      },
      
      fun_facts: this._generateFunFacts(path, personality, completionRate),
      
      generated_at: new Date().toISOString(),
    };
  }

  static async _getSeriesInfo(seriesId) {
    const [rows] = await pool.query(
      'SELECT * FROM drama_series WHERE id = ?',
      [seriesId]
    );
    return rows[0] || null;
  }

  static async _getAllNodes(seriesId) {
    const [rows] = await pool.query(
      'SELECT * FROM drama_nodes WHERE series_id = ?',
      [seriesId]
    );
    return rows;
  }

  static async _extractKeyDecisions(path, seriesId) {
    if (path.length < 2) return [];
    
    const decisions = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const fromNode = path[i];
      const toNode = path[i + 1];
      
      const [edges] = await pool.query(
        `SELECT * FROM drama_edges 
         WHERE from_node_id = ? AND to_node_id = ? 
         LIMIT 1`,
        [fromNode.node_id, toNode.node_id]
      );
      
      if (edges.length > 0) {
        const edge = edges[0];
        let tags = [];
        if (edge.personality_tags) {
          try {
            tags = JSON.parse(edge.personality_tags);
          } catch (e) {}
        }
        
        decisions.push({
          step: i + 1,
          from_node: fromNode.node_title,
          to_node: toNode.node_title,
          choice: edge.option_text,
          choice_label: edge.option_label,
          personality_tags: tags,
          comment: this._getDecisionComment(tags),
        });
      }
    }
    
    return decisions;
  }

  static _getDecisionComment(tags) {
    if (!tags || tags.length === 0) {
      return '这个选择嘛...不好说。';
    }
    
    const tag = tags[0];
    const comments = COMMENTS[tag];
    return comments ? pickRandom(comments) : '有意思的选择。';
  }

  static _generatePersonalitySummary(personality) {
    if (!personality.traits || personality.traits.length === 0) {
      return '你像一张白纸一样纯洁...因为你还没做任何选择。';
    }
    
    const topTraits = personality.traits.slice(0, 3);
    
    const parts = topTraits.map((t, idx) => {
      if (idx === 0) {
        return `${t.trait_name}（${t.score}分）占据了你性格的半壁江山`;
      }
      return `${t.trait_name}（${t.score}分）也有一席之地`;
    });
    
    return '总的来说，' + parts.join('，') + '。';
  }

  static _generateOverallComment(isEnding, endingType, personality, pathLength) {
    if (!isEnding) {
      return `你这才看到第${pathLength}章就想复盘？再看看吧~`;
    }
    
    const endingComments = ENDING_COMMENTS[endingType] || ENDING_COMMENTS.neutral;
    const endingComment = pickRandom(endingComments);
    
    const dominantTrait = personality.dominant_trait;
    let personalityComment = '';
    if (dominantTrait && COMMENTS[dominantTrait]) {
      personalityComment = pickRandom(COMMENTS[dominantTrait]);
    }
    
    return `${endingComment} ${personalityComment}`.trim();
  }

  static _generateTitle(personality, endingType) {
    const dominant = personality.dominant_trait;
    const traitName = personality.traits?.find(t => t.trait_key === dominant)?.trait_name || '神秘';
    
    const titles = {
      good: [
        `「${traitName}玩家」的完美通关之路`,
        `天选之子的${traitName}通关指南`,
        `恭喜！你是真正的${traitName}赢家`,
      ],
      bad: [
        `「${traitName}型」作死实录`,
        `${traitName}的一百种死法`,
        `警惕${traitName}陷阱！一名玩家的惨痛教训`,
      ],
      neutral: [
        `一个${traitName}玩家的普通冒险`,
        `${traitName}路人的平平无奇之旅`,
        `${traitName}？也就那样吧。`,
      ],
    };
    
    const pool = titles[endingType] || titles.neutral;
    return pickRandom(pool);
  }

  static _generateFunFacts(path, personality, completionRate) {
    const facts = [];
    
    facts.push(`你一共做出了 ${personality.total_choices || 0} 个重大人生抉择`);
    
    if (completionRate < 30) {
      facts.push(`全剧 ${completionRate}% 的完成度，你这是刚出门就回来了？`);
    } else if (completionRate < 70) {
      facts.push(`完成度 ${completionRate}%，还有大半剧情等着你发现哦~`);
    } else {
      facts.push(`完成度 ${completionRate}%！你快把这剧盘包浆了`);
    }
    
    if (personality.traits && personality.traits.length > 0) {
      const top = personality.traits[0];
      facts.push(`你的「${top.trait_name}」属性爆表，建议去测一下MBTI`);
    }
    
    facts.push(`这条路线你一共看了 ${path.length} 个片段，比刷短视频还上头`);
    
    const totalScore = personality.traits?.reduce((sum, t) => sum + t.score, 0) || 0;
    facts.push(`性格总积分 ${totalScore} 分，可以去商城换皮肤了（并没有）`);
    
    return facts;
  }
}

module.exports = BattleReportService;
