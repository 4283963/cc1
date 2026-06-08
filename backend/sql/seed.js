require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/mysql');

const SAMPLE_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';
const SAMPLE_VIDEO_URL_2 = 'https://www.w3schools.com/html/movie.mp4';

async function seed() {
  console.log('🌱 开始植入种子数据...');

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('📋 执行数据库 schema...');
    
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        if (!err.message.includes('Duplicate column') && 
            !err.message.includes("doesn't exist") &&
            !err.message.includes('Duplicate entry') &&
            !err.message.includes('Can\'t DROP')) {
          console.warn('⚠️  执行语句警告:', err.message.substring(0, 100));
        }
      }
    }

    console.log('✅ Schema 初始化完成');

    const [seriesResult] = await pool.query(
      `INSERT INTO drama_series (title, description, cover_image) 
       VALUES (?, ?, ?)`,
      [
        '密室逃脱：神秘庄园',
        '你被困在一座神秘的古老庄园里，每个选择都将决定你的命运。你能成功逃脱吗？',
        'https://example.com/cover.jpg'
      ]
    );
    const seriesId = seriesResult.insertId;
    console.log(`📺 创建剧集: ID=${seriesId}`);

    const nodes = [
      { id: 1, title: '第一章：苏醒', description: '你在一间昏暗的房间里醒来，头很痛...', duration: 60, is_ending: 0 },
      { id: 2, title: '第二章：选择', description: '你来到走廊，看到两扇门...', duration: 90, is_ending: 0 },
      { id: 3, title: '分支A：开门', description: '你决定打开那扇神秘的门...', duration: 45, is_ending: 0 },
      { id: 4, title: '分支B：翻墙', description: '你决定尝试翻墙逃跑...', duration: 45, is_ending: 0 },
      { id: 5, title: '第三章：密室', description: '门后是一个奇怪的密室...', duration: 60, is_ending: 0 },
      { id: 6, title: '第三章：花园', description: '你成功翻过了墙，来到一个花园...', duration: 60, is_ending: 0 },
      { id: 7, title: '结局：逃脱成功', description: '你找到了出口，成功逃出了庄园！', duration: 30, is_ending: 1, ending_type: 'good' },
      { id: 8, title: '结局：被困永恒', description: '你触发了陷阱，永远被困在了这里...', duration: 30, is_ending: 1, ending_type: 'bad' },
      { id: 9, title: '结局：发现真相', description: '你发现了庄园的秘密，获得了新生...', duration: 30, is_ending: 1, ending_type: 'good' },
    ];

    for (const node of nodes) {
      await pool.query(
        `INSERT INTO drama_nodes (id, series_id, title, description, video_url, duration, is_ending, ending_type) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description)`,
        [
          node.id,
          seriesId,
          node.title,
          node.description,
          node.id % 2 === 0 ? SAMPLE_VIDEO_URL : SAMPLE_VIDEO_URL_2,
          node.duration,
          node.is_ending,
          node.ending_type || null
        ]
      );
    }
    console.log(`🎬 植入了 ${nodes.length} 个剧情节点`);

    await pool.query('UPDATE drama_series SET root_node_id = 1 WHERE id = ?', [seriesId]);

    const personalityTraits = [
      { key: 'brave', name: '勇敢', color: '#ff6b6b', opposite: 'cowardly', desc: '敢于面对危险，勇往直前' },
      { key: 'cowardly', name: '胆小', color: '#74b9ff', opposite: 'brave', desc: '谨慎小心，不轻易冒险' },
      { key: 'violent', name: '暴躁', color: '#ff4757', opposite: 'peaceful', desc: '遇事冲动，喜欢用武力解决' },
      { key: 'peaceful', name: '温和', color: '#2ed573', opposite: 'violent', desc: '性格平和，追求和谐' },
      { key: 'smart', name: '机智', color: '#ffa502', opposite: 'reckless', desc: '聪明伶俐，善于思考' },
      { key: 'reckless', name: '鲁莽', color: '#ff6348', opposite: 'smart', desc: '做事不计后果，横冲直撞' },
      { key: 'cautious', name: '谨慎', color: '#70a1ff', opposite: 'curious', desc: '小心谨慎，三思而后行' },
      { key: 'curious', name: '好奇', color: '#eccc68', opposite: 'cautious', desc: '充满好奇心，喜欢探索未知' },
    ];

    for (const trait of personalityTraits) {
      await pool.query(
        `INSERT INTO personality_traits (trait_key, trait_name, color, opposite_trait, description) 
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE trait_name=VALUES(trait_name), color=VALUES(color), 
         opposite_trait=VALUES(opposite_trait), description=VALUES(description)`,
        [trait.key, trait.name, trait.color, trait.opposite, trait.desc]
      );
    }
    console.log(`🎭 植入了 ${personalityTraits.length} 个性格标签`);

    const edges = [
      { from: 1, to: 2, text: '继续探索', label: 'A', trigger_time: 30, weight: 10, sort: 1, 
        tags: ['curious', 'brave'] },
      { from: 2, to: 3, text: '开门', label: 'A', trigger_time: 45, weight: 8, sort: 1, 
        tags: ['brave', 'curious'] },
      { from: 2, to: 4, text: '翻墙', label: 'B', trigger_time: 45, weight: 6, sort: 2, 
        tags: ['reckless', 'brave'] },
      { from: 3, to: 5, text: '进入密室', label: 'A', trigger_time: 25, weight: 5, sort: 1, 
        tags: ['curious', 'smart'] },
      { from: 3, to: 8, text: '触发陷阱', label: 'B', trigger_time: 25, weight: 2, sort: 2, 
        tags: ['reckless', 'violent'] },
      { from: 4, to: 6, text: '进入花园', label: 'A', trigger_time: 25, weight: 7, sort: 1, 
        tags: ['peaceful', 'cautious'] },
      { from: 5, to: 7, text: '找到钥匙', label: 'A', trigger_time: 35, weight: 4, sort: 1, 
        tags: ['smart', 'cautious'] },
      { from: 5, to: 8, text: '打开错误的门', label: 'B', trigger_time: 35, weight: 3, sort: 2, 
        tags: ['reckless', 'curious'] },
      { from: 6, to: 9, text: '发现隐藏通道', label: 'A', trigger_time: 35, weight: 5, sort: 1, 
        tags: ['smart', 'curious'] },
      { from: 6, to: 7, text: '找到大门', label: 'B', trigger_time: 35, weight: 6, sort: 2, 
        tags: ['cautious', 'peaceful'] },
    ];

    for (const edge of edges) {
      await pool.query(
        `INSERT INTO drama_edges (from_node_id, to_node_id, option_text, option_label, trigger_time, weight, sort_order, personality_tags) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          edge.from, 
          edge.to, 
          edge.text, 
          edge.label, 
          edge.trigger_time, 
          edge.weight, 
          edge.sort,
          JSON.stringify(edge.tags)
        ]
      );
    }
    console.log(`🔗 植入了 ${edges.length} 条剧情分支`);

    const timestamps = [
      { node: 1, time: 30, type: 'branch', desc: '第一个选择点' },
      { node: 2, time: 45, type: 'branch', desc: '关键选择点' },
      { node: 3, time: 25, type: 'branch', desc: '密室分支' },
      { node: 4, time: 25, type: 'branch', desc: '花园分支' },
      { node: 5, time: 35, type: 'branch', desc: '结局选择' },
      { node: 6, time: 35, type: 'branch', desc: '结局选择' },
    ];

    for (const ts of timestamps) {
      await pool.query(
        `INSERT INTO video_timestamps (node_id, timestamp, type, description) 
         VALUES (?, ?, ?, ?)`,
        [ts.node, ts.time, ts.type, ts.desc]
      );
    }
    console.log(`⏱️  植入了 ${timestamps.length} 个视频埋点`);

    const regions = ['beijing', 'shanghai', 'guangzhou', 'chengdu'];
    const nodeIds = [2, 3, 4, 5, 6, 7, 8, 9];
    let cdnCount = 0;

    for (const nodeId of nodeIds) {
      for (const region of regions) {
        const isCached = Math.random() > 0.4;
        const hitCount = isCached ? Math.floor(Math.random() * 100) + 10 : Math.floor(Math.random() * 10);
        const missCount = isCached ? Math.floor(Math.random() * 20) : Math.floor(Math.random() * 50) + 20;

        await pool.query(
          `INSERT INTO cdn_cache_status (node_id, region, is_cached, hit_count, miss_count, last_hit_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            nodeId,
            region,
            isCached ? 1 : 0,
            hitCount,
            missCount,
            isCached ? new Date() : null
          ]
        );
        cdnCount++;
      }
    }
    console.log(`🌐 植入了 ${cdnCount} 条 CDN 缓存数据`);

    console.log('\n🎉 种子数据植入完成！');
    console.log(`📺 剧集ID: ${seriesId}`);
    console.log(`🎬 剧情节点: ${nodes.length} 个`);
    console.log(`🔗 剧情分支: ${edges.length} 条`);
    console.log(`🌐 CDN 区域: ${regions.length} 个`);
    console.log('\n🚀 可以启动后端服务了: cd backend && npm run dev');

  } catch (err) {
    console.error('❌ 植入种子数据失败:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
