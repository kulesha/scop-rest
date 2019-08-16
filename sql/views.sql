CREATE VIEW `rest_folds` AS select `f`.`cl_id` AS `parent_id`,`f`.`cf_id` AS `id`,`f`.`cf_name` AS `name`,`f`.`cf_comment` AS `description`,`f`.`cf_attribute` AS `type`,`f`.`type_id` AS `protein_type_id`,`node2domain4display`.`dom_id` AS `domain` from (`fold` `f` left join `node2domain4display` on((`f`.`cf_id` = `node2domain4display`.`node_id`))) where (`f`.`cf_status` = 'active');
CREATE VIEW `rest_superfamilies` AS select `sf`.`cf_id` AS `parent_id`,`sf`.`sf_id` AS `id`,`sf`.`sf_name` AS `name`,`sf`.`sf_comment` AS `description`,`node2domain4display`.`dom_id` AS `domain` from (`superfamily` `sf` left join `node2domain4display` on((`sf`.`sf_id` = `node2domain4display`.`node_id`))) where (`sf`.`sf_status` = 'active');
CREATE VIEW `rest_families` AS select `family`.`sf_id` AS `parent_id`,`family`.`fa_id` AS `id`,`family`.`fa_name` AS `name`,`family`.`fa_comment` AS `description`,`node2domain4display`.`dom_id` AS `domain` from (`family` left join `node2domain4display` on((`family`.`fa_id` = `node2domain4display`.`node_id`))) where ((`family`.`fa_status` = 'active') and (not((`family`.`fa_name` like '%autofam%'))));
CREATE VIEW `rest_search` AS select `rest_folds`.`id` AS `id`,`rest_folds`.`name` AS `name`,`rest_folds`.`description` AS `description`,'fold' AS `type` from `rest_folds` union select `rest_superfamilies`.`id` AS `id`,`rest_superfamilies`.`name` AS `name`,`rest_superfamilies`.`description` AS `description`,'superfamily' AS `type` from `rest_superfamilies` union select `rest_families`.`id` AS `id`,`rest_families`.`name` AS `name`,`rest_families`.`description` AS `description`,'family' AS `type` from `rest_families`;
CREATE VIEW `rest_search_id` AS select `domain_scop_cla`.`dom_id` AS `id`,`domain_segment`.`pdb_code` AS `pdb_id`,`rs`.`ext_db_id` AS `uniprot_id`,group_concat(concat_ws(':',`domain_segment`.`pdb_chain`,concat_ws('-',`domain_segment`.`pdb_begin`,`domain_segment`.`pdb_end`)) separator ', ') AS `name` from (`domain_scop_cla` left join `domain_segment` using (dom_id) left join `representative_sequence` `rs` on((`domain_segment`.`repre_seq` = `rs`.`rep_seq_id`))) where dom_mark = 'ready' and domain_type in ('SF', 'FA') group by `id`,`pdb_id`,`uniprot_id`;

CREATE VIEW rest_segments as select dsc.node_id as node_id, dsc.dom_id as id, serial, dsc.domain_type as type, ds.pdb_code as pdb_id, pdb_chain, pdb_begin, pdb_end, seq_begin, seq_end, rs.rep_name as protein_name, ext_db_id as uniprot_id, ncbi.scientific_name as species_name from domain_scop_cla dsc left join domain_segment ds using (dom_id) left join representative_sequence rs on ds.repre_seq = rs.rep_seq_id left join ncbi_taxonomy ncbi using (ncbi_taxa_id) where dom_mark = 'ready' and domain_type in ('SF', 'FA');
CREATE VIEW rest_domains as select sum(if(cm.repre_dom_id, 1, 0)) as num, rs.* from rest_segments rs left join cluster_members cm on rs.id = cm.repre_dom_id group by id, serial, type, pdb_id, pdb_chain, pdb_begin, pdb_end, seq_begin, seq_end, protein_name, uniprot_id, species_name;

CREATE index domid_index on cluster_members(repre_dom_id) ;

update fold set last_modified = date_created where last_modified < '2001-01-01';
update superfamily set last_modified = date_created where last_modified < '2001-01-01';
update family set last_modified = date_created where last_modified < '2001-01-01';

alter table fold modify column last_modified date default NULL;
alter table superfamily modify column last_modified date default NULL;
alter table family modify column last_modified date default NULL;

create fulltext index search_fold on fold(cf_name, cf_comment);
create fulltext index search_superfamily on superfamily(sf_name, sf_comment);
create fulltext index search_family on family(fa_name, fa_comment);