CREATE TABLE IF NOT EXISTS `sys_user` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `is_manager` int(11) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `birthday` date DEFAULT NULL,
  `mobile` varchar(30) DEFAULT NULL,
  `addr` varchar(2000) DEFAULT NULL,
  `user_password` varchar(50) DEFAULT NULL,
  `is_ns_user` int(11) DEFAULT '0' COMMENT '是否可为ns用户，0：否，1：是',
  `status` int(11) DEFAULT '1' COMMENT '是否可用，0：不可用，1：可用',
  `create_date` datetime DEFAULT NULL,
  `update_date` datetime DEFAULT NULL,
  `user_source` int(11) DEFAULT NULL COMMENT '1:oa，2:erp',
  `workcode` varchar(100) DEFAULT NULL,
  `subcompany_id` varchar(100) DEFAULT NULL COMMENT '分部ID',
  `subcompany_name` varchar(255) DEFAULT NULL COMMENT '分部名称',
  `manager_user_id` int(11) DEFAULT NULL COMMENT '上级id',
  `department_id` varchar(100) DEFAULT NULL COMMENT '部门id',
  `department_name` varchar(255) DEFAULT NULL COMMENT '部门名称',
  `english_name` varchar(255) DEFAULT NULL COMMENT '英文名',
  `cost_center` varchar(100) DEFAULT NULL,
  `cost_center_name` varchar(100) DEFAULT NULL,
  `subcompany_all_name` varchar(100) DEFAULT NULL,
  `jobtitleid` varchar(100) DEFAULT NULL COMMENT '职位id',
  `full_jobtitle` varchar(100) DEFAULT NULL COMMENT '职位',
  `chinese_name` varchar(255) DEFAULT NULL COMMENT '中文名',
  `leave_date` date DEFAULT NULL COMMENT '离职日期',
  `employment_date` date DEFAULT NULL COMMENT '入职日期',
  `positive_date` date DEFAULT NULL COMMENT '转正日期',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`),
  KEY `is_new` (`first_name`),
  KEY `is_manager` (`is_manager`),
  KEY `idx_sys_user_status_email` (`status`, `email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- 登录校验规则：
-- 1. 仅使用 email 登录。
-- 2. 仅允许 status = 1 的用户登录。
-- 3. user_password 存储 MD5(明文密码) 的 32 位大写十六进制值。
--
-- 生成密码示例：
-- SELECT UPPER(MD5('你的密码'));
