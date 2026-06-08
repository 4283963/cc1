-- 互动短剧播放系统数据库 schema

CREATE DATABASE IF NOT EXISTS interactive_drama DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE interactive_drama;

-- 剧集表
DROP TABLE IF EXISTS drama_series;
CREATE TABLE drama_series (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL COMMENT '剧集名称',
  description TEXT COMMENT '剧集描述',
  cover_image VARCHAR(500) COMMENT '封面图',
  root_node_id INT COMMENT '起始节点ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='剧集表';

-- 剧情节点表
DROP TABLE IF EXISTS drama_nodes;
CREATE TABLE drama_nodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  series_id INT NOT NULL COMMENT '所属剧集ID',
  title VARCHAR(255) NOT NULL COMMENT '节点标题',
  description TEXT COMMENT '节点描述',
  video_url VARCHAR(500) NOT NULL COMMENT '主视频URL',
  duration INT NOT NULL DEFAULT 0 COMMENT '视频时长(秒)',
  is_ending TINYINT(1) DEFAULT 0 COMMENT '是否为结局节点',
  ending_type VARCHAR(50) DEFAULT NULL COMMENT '结局类型: good/bad/neutral',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_series (series_id),
  INDEX idx_ending (is_ending),
  FOREIGN KEY (series_id) REFERENCES drama_series(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='剧情节点表';

-- 剧情分支表（节点之间的连接边）
DROP TABLE IF EXISTS drama_edges;
CREATE TABLE drama_edges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_node_id INT NOT NULL COMMENT '来源节点ID',
  to_node_id INT NOT NULL COMMENT '目标节点ID',
  option_text VARCHAR(255) NOT NULL COMMENT '选项文字',
  option_label VARCHAR(10) DEFAULT NULL COMMENT '选项标签(A/B等)',
  trigger_time INT NOT NULL DEFAULT 0 COMMENT '触发时间点(秒)',
  weight INT DEFAULT 0 COMMENT '权重(用于CDN优化排序)',
  sort_order INT DEFAULT 0 COMMENT '显示排序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_from_node (from_node_id),
  INDEX idx_to_node (to_node_id),
  FOREIGN KEY (from_node_id) REFERENCES drama_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (to_node_id) REFERENCES drama_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='剧情分支表';

-- 用户观看历史表
DROP TABLE IF EXISTS user_watch_history;
CREATE TABLE user_watch_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL COMMENT '用户ID',
  series_id INT NOT NULL COMMENT '剧集ID',
  node_id INT NOT NULL COMMENT '观看的节点ID',
  region VARCHAR(50) DEFAULT NULL COMMENT '用户所在区域',
  watch_duration INT DEFAULT 0 COMMENT '观看时长(秒)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_series (user_id, series_id),
  INDEX idx_node (node_id),
  INDEX idx_created (created_at),
  FOREIGN KEY (series_id) REFERENCES drama_series(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES drama_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户观看历史表';

-- CDN 缓存命中统计表
DROP TABLE IF EXISTS cdn_cache_status;
CREATE TABLE cdn_cache_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  node_id INT NOT NULL COMMENT '节点ID',
  region VARCHAR(50) NOT NULL COMMENT 'CDN区域',
  is_cached TINYINT(1) DEFAULT 0 COMMENT '是否已缓存',
  hit_count INT DEFAULT 0 COMMENT '命中次数',
  miss_count INT DEFAULT 0 COMMENT '未命中次数',
  last_hit_at TIMESTAMP NULL COMMENT '最后命中时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_node_region (node_id, region),
  INDEX idx_region (region),
  INDEX idx_cached (is_cached),
  FOREIGN KEY (node_id) REFERENCES drama_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='CDN缓存状态表';

-- 埋点时间表（辅助表，记录每个节点的决策埋点）
DROP TABLE IF EXISTS video_timestamps;
CREATE TABLE video_timestamps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  node_id INT NOT NULL COMMENT '节点ID',
  timestamp INT NOT NULL COMMENT '埋点时间(秒)',
  type VARCHAR(50) DEFAULT 'branch' COMMENT '埋点类型: branch/ending/info',
  description VARCHAR(255) DEFAULT NULL COMMENT '埋点描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_node (node_id),
  FOREIGN KEY (node_id) REFERENCES drama_nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='视频埋点表';
