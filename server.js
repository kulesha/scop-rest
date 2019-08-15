const url = require('url');
const fs = require('fs');
let config_file = "/opt/scop/config.json";

function getArgs () {
    const args = {};
    process.argv.slice(2).forEach(function (val, index, array) {
        const longArg = val.split('=');
        args[longArg[0].slice(2)] = longArg[1];
    });
    return args;
}
const args = getArgs();

if (args.config) {
    config_file = args.config;
}

let rawdata = fs.readFileSync(config_file);
let config = JSON.parse(rawdata);

let debug = 1;
if ('debug2' in config) {
    debug = config.debug;
}

let WEB_PORT = 80;
if ('webport' in config) {
    WEB_PORT = config.webport;
}

if (debug) {
    console.log(config);
    console.log("Using CONFIGURATION from " + config_file);
}

var express = require('express');
var mysql = require('mysql');  
var dbpool = mysql.createPool(config);
/*
var dbpool  = mysql.createPool({
    connectionLimit : 10,
    host: "localhost",
    user: "scop",
    password: "scop2",
    database: "scop2",
});
 */


var app = express();

// define routes here..

app.use(express.static(__dirname + 'public'));

var server = app.listen(WEB_PORT, function () {
    console.log('SCOP REST API server is running on port ' + WEB_PORT);
    console.log("Debug info is " + (debug ? "ON" : "OFF"));
});

app.use('/static', express.static(__dirname + '/public/static'));

app.get('/', function(req, res){
    res.sendFile('index.html', { root: __dirname + "/public" } );
});

app.get('/stats', function(req, res){
    return fetchStatsFromDB(res);
});

app.use('/term', function( req, res){
    var path = req.path.split(/[\/\?]/); 
    if (debug > 1) {
        console.log(path);
    }
    if (path.length< 2 || !path[1]) {
        return printError(res, "Invalid path: " + req.path)
    } 
    var termId = parseInt(path[1]);
    if (termId) {
        return fetchTermFromDB(termId, res);
    } else {
        return printError(res, "Invalid id: " +  path[1]);
    }
});

app.use('/parents', function( req, res){
    var path = req.path.split(/[\/\?]/);
 
    if (path.length< 2 || !path[1]) {
        return printError(res, "Invalid path: " + req.path)
    } 

    var termId = parseInt(path[1]);
    if (termId) {
        return fetchParentsFromDB(termId, res);
    } else {
        return printError(res, "Invalid id: " +  path[1]);
    }

});

app.use('/children', function( req, res){
    var path = req.path.split(/[\/\?]/);
    if (path.length< 2 || !path[1]) {
        return printError(res, "Invalid path: " + req.path)
    } 
    var termId = parseInt(path[1]);
    if (termId) {
        return fetchChildrenFromDB(termId, res);
    } else {
        return printError(res, "Invalid id: " +  path[1]);
    }
});

app.use('/domains', function( req, res){
    var path = req.path.split(/[\/\?]/);
    if (path.length< 2 || !path[1]) {
        return printError(res, "Invalid path: " + req.path)
    } 
    var termId = parseInt(path[1]);
    if (termId) {
        return fetchDomainsFromDB(termId, res);
    } else {
        return printError(res, "Invalid id: " +  path[1]);
    }
});

app.use('/represented_structures', function( req, res){
    var path = req.path.split(/[\/\?]/);

    if (path.length< 2 || !path[1]) {
        return printError(res, "Invalid path: " + req.path)
    } 

    var termId = parseInt(path[1]);
    if (termId) {
        return fetchRepresentedStructuresFromDB(termId, res);
    } else {
        return printError(res, "Invalid id: " +  path[1]);
    }
});

app.use('/domains_by_uniprot', function( req, res){
    var path = req.path.split(/[\/\?]/);
   
    if (path.length< 2 || !path[1]) {
        return printError(res, "Invalid path: " + req.path)
    } 

    var uniprot = path[1];
    return fetchDomainsByUniProtFromDB(uniprot, res)
});

app.use('/ancestry', function( req, res){
    var path = req.path.split(/[\/\?]/);

    if (path.length< 2 || !path[1]) {
        return printError(res, "Invalid path: " + req.path)
    } 

    var termId = parseInt(path[1]);
    if (termId) {
        return fetchAncestryFromDB(termId, res);
    } else {
        return printError(res, "Invalid id: " +  path[1]);
    }
});

function printError( res, msg) {
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept"
    }
    );
    let json = {
        error: msg
    }
    res.write(JSON.stringify(json));
    res.end();
}

function printTerm( res, tdata) {
    res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept"
    }
    );
    res.write(JSON.stringify(tdata));
    res.end();
}

app.use('/search', function( req, res){
    var query = url.parse(req.url, true).path.substr(2);
    // Looking for ?q=TEXT_TO_SEARCH
    var qObj = query.split(';').reduce( function(p,n){ var kv = n.split('='); p[kv[0]] = kv[1]; return p; }, {} );
    return fetchSearchFromDB(qObj.q, res);
});

/*** Data retrieval ***/

function fetchStatsFromDB(res) {
    let tdata = {
        'release-date': '2019-07-31',
        'counts' : []
    };

    const sql = "SELECT COUNT(*) AS folds, (select count(*) from fold where cf_status = 'active' and cf_attribute = 'iupr') as IUPR, ( select count(*) from hyperfamily where hf_status = 'active') AS hyperfamilies, (select count(*) from superfamily where sf_status = 'active') as superfamilies, (select count(*) from family where fa_status = 'active' and fa_name not like '%AUTOFAM%') as families, (select count(*) from inter_relationships) as `inter-relationships` from fold where cf_status = 'active' and cf_attribute = 'fold'";
    const fields = ['folds', 'IUPR', 'hyperfamilies', 'superfamilies', 'families', 'inter-relationships'];
    if (debug) {
        console.log("SQL ( stats )# ", sql);
    }

    dbpool.query(sql, function(err, result) {
        if (err) {
            return printError(res, err);
        }         
        if (result.length) {
            fields.map( (f) =>{
                tdata.counts.push([f, result[0][f]]);
            });
        }
        return printTerm(res, tdata);
    }); 
}

function fetchParentsFromDB(termId, res) {    
    const termRank  = Math.floor(termId / 1000000);
    let sql = '';
    let tdata = {
        id: termId,
        parents: []
    };

    if (termRank < 2) { // Classes and Types do not have types
        return printTerm(res, tdata);
    } else if (termRank == 2) { // Folds and IUPR will have class and protein type
        sql = "SELECT cl_id AS id, cl_name AS name, 'structural class' AS type, pt.type_id as pt_id, pt.type_name as pt_name from fold cf left join class cl using (cl_id) left join protein_types pt using (type_id) where cf_id = " + termId;
    } else if (termRank == 3) { // Superfamily will have a fold as a parent
        sql = "SELECT cf_id as id, cf_name as name, 'fold' as type FROM fold p LEFT JOIN superfamily c USING(cf_id) WHERE sf_id = " + termId;
    } else if (termRank == 4) { // Family will have a family as a parent
        sql = "SELECT sf_id as id, sf_name as name, 'superfamily' as type FROM superfamily p LEFT JOIN family c USING(sf_id) WHERE fa_id = "+ termId;      
    } else if (termRank == 8) { // In case of domains we dont't know where the parent comes from
        sql = "select fa.fa_id, fa.fa_name, sf.sf_id, sf.sf_name, hf.hf_id, hf.hf_name, cf.cf_id, cf.cf_name from domain_scop_cla dsc left join family fa on dsc.node_id = fa.fa_id left join superfamily sf on dsc.node_id = sf.sf_id left join hyperfamily hf on dsc.node_id = hf.hf_id left join fold cf on dsc.node_id = cf.cf_id where dom_id = " + termId;
    } else {
        return printError(res, "Invalid term id: " + termId);     
    }

    if (debug) {
        console.log("PRNT SQL:", sql);
    }

    dbpool.query(sql, function (err, result) {
        if (err) {
            return printError(res, err);
        };

        if (result.length) {
            if (termRank == 8) { // In case of domains the parents can come from various tables - and it defines the type of the domain
                let parents = []
                result.map( (i) => {
                    if (i.fa_id) {
                        parents.push({
                            id : i.fa_id,
                            name: i.fa_name,
                            type: 'family'
                        })
                    }
                    if (i.sf_id) {
                        parents.push({
                            id : i.sf_id,
                            name: i.sf_name,
                            type: 'superfamily'
                        })
                    }
                    if (i.hf_id) {
                        parents.push({
                            id : i.hf_id,
                            name: i.hf_name,
                            type: 'hyperfamily'
                        })
                    }

                    if (i.cf_id) {
                        parents.push({
                            id : i.cf_id,
                            name: i.cf_name,
                            type: 'fold'
                        })
                    }
                })
                //console.log(parents);
                tdata.parents = parents;
                return printTerm(res, tdata);
            } else if ([3,4].includes(termRank)) { // In case of families and superfamlies we also need to check the descent table for extra parents
                tdata.parents = result;
                let sql2 = "SELECT cf.cf_id, cf_name, sf.sf_id, sf.sf_name FROM descent LEFT JOIN fold cf ON node1_id = cf_id LEFT JOIN superfamily sf ON node1_id = sf.sf_id WHERE node2_id = " + termId + ' AND node1_id NOT in (select hf_id from hyperfamily)';
                if (debug) {
                    console.log("PRNT SQL EXTRA:", sql2);
                }
                
                dbpool.query(sql2, function (err, result) {
                    if (err) {
                        return printError(res, err);
                    };
                    if (result.length) {
                        let extra_parents = []
                        result.map( (i) => {
                            if (i.cf_id) {
                                extra_parents.push({
                                    id : i.cf_id,
                                    name: i.cf_name,
                                    type: 'fold'
                                })
                            }
                            if (i.sf_id) {
                                extra_parents.push({
                                    id : i.sf_id,
                                    name: i.sf_name,
                                    type: 'superfamily'
                                })
                            }
                        });
                        tdata.parents = [...tdata.parents, ...extra_parents].sort(function(a,b){
                            return (a.id > b.id) ? 1 : -1;
                        });
                    }
                    return printTerm(res, tdata);
                });
            } else {
                tdata.parents = result;
                return printTerm(res, tdata);
            }
        } 
    });
}

function fetchTermFromDB(termId, res) {
    const termRank  = Math.floor(termId / 1000000);
    let sql = '', sql2 = '', sql3 = '', sql4 = '';

    if (termRank == 1) {
        sql  = 'SELECT cl_id as id, cl_name as name, comment as description FROM class WHERE cl_id = ' + termId;
        // classes have no annotations
        sql2 = 'SELECT * from class WHERE cl_id < 0';
        sql3 = "SELECT cf.id, cf.name, cf.description, cf.type, cf.domain, count(*) AS cnum FROM rest_folds cf LEFT JOIN rest_superfamilies sf on cf.id = sf.parent_id WHERE cf.parent_id = " + termId + " GROUP BY id, name, description, domain ORDER BY cnum DESC";
    } else if (termRank == 2) {
        sql  = 'SELECT cf_id as id, cf_name as name, cf_comment as description, type_name as protein_type, type_id as protein_type_id, cf_attribute as type FROM fold left join protein_types using (type_id) WHERE cf_id = ' + termId;
        sql2 = 'SELECT cf_id as id, kw.*, tg.*, ir.*, ev.*, hf.* FROM fold LEFT JOIN kwd2nodes kwd ON cf_id = kwd.node_id LEFT JOIN keywords kw using(kwd_id) LEFT JOIN tags2nodes tgt ON cf_id = tgt.node_id LEFT JOIN structural_tags tg using (tag_id) LEFT JOIN ir_nodes_relations irn on cf_id = irn.node_id LEFT JOIN inter_relationships ir using (ir_id) left join hypo_event2nodes_relations henr on cf_id = henr.node_id left join hypothetical_evolutionary_event ev using(event_id) left join descent dsc on cf_id = dsc.node2_id left join hyperfamily hf on dsc.node1_id = hf_id where cf_id = ' + termId;
        sql3 = "SELECT sf.id, sf.name, sf.description, sf.domain, count(*) AS cnum FROM rest_superfamilies sf LEFT JOIN rest_families f on sf.id = f.parent_id WHERE sf.parent_id = " + termId  + " OR sf.id IN (SELECT node2_id FROM descent WHERE node1_id = " + termId + ") GROUP BY id, name, description, domain ORDER BY cnum DESC";
        sql4 = "SELECT fa_id as id, fa_name as name, fa_comment as description, 0 as cnum, dom_id as domain from family left join node2domain4display on fa_id = node_id where fa_id IN ( SELECT node2_id FROM descent WHERE node1_id = " + termId + ") AND fa_status = 'active' AND fa_name NOT LIKE '%autofam%'";
    } else if (termRank == 3) {
        sql  = 'SELECT sf_id as id, sf_name as name, sf_comment as description FROM superfamily WHERE sf_id = ' + termId;
        sql2 = 'SELECT sf_id as id, kw.*, tg.*, ir.*, ev.*, hf.* FROM superfamily  left join kwd2nodes kwd on sf_id = kwd.node_id left join keywords kw using(kwd_id) left join tags2nodes tgt on sf_id = tgt.node_id left join structural_tags tg using (tag_id) LEFT JOIN ir_nodes_relations irn on sf_id = irn.node_id left join inter_relationships ir using (ir_id) left join hypo_event2nodes_relations henr on sf_id = henr.node_id left join hypothetical_evolutionary_event ev using(event_id) left join descent dsc on sf_id = dsc.node2_id left join hyperfamily hf on dsc.node1_id = hf_id where sf_id = ' + termId;
        sql3 = "SELECT id, name, description, domain, 0 as cnum FROM rest_families WHERE parent_id = " + termId + " OR id IN (SELECT node2_id FROM descent WHERE node1_id = " + termId + ")";
    } else if (termRank == 4) {
        sql  = 'SELECT fa_id as id, fa_name as name, fa_comment as description , func.description as protein_function from family left join `functions` func USING (func_anno) WHERE fa_id = ' + termId;
        sql2 = 'SELECT fa_id as id, kw.*, tg.*, ir.*, ev.*, hf.* FROM family  left join kwd2nodes kwd on fa_id = kwd.node_id left join keywords kw using(kwd_id) left join tags2nodes tgt on fa_id = tgt.node_id left join structural_tags tg using (tag_id) LEFT JOIN ir_nodes_relations irn on fa_id = irn.node_id left join inter_relationships ir using (ir_id) left join hypo_event2nodes_relations henr on fa_id = henr.node_id left join hypothetical_evolutionary_event ev using(event_id) left join descent dsc on fa_id = dsc.node2_id left join hyperfamily hf on dsc.node1_id = hf_id where fa_id = ' + termId;
        // Families have no children
        sql3 = 'SELECT * from class WHERE cl_id < 0';
        sql4 = "SELECT pfam_id as id, 'pfam' as type from family2pfam where fam_id = " + termId;
    } else if (termRank == 8) {
        sql  = "SELECT sequence, ext_db_id as uniprot_id, rs.rep_name as description, ncbi.scientific_name as protein_species, dom_id as id, pdb_code as name, pdb_code as pdb_id, pdb_chain, pdb_begin, pdb_end, repre_seq, seq_begin, seq_end FROM domain_segment ds left join representative_sequence rs on ds.repre_seq = rs.rep_seq_id left join ncbi_taxonomy ncbi using (ncbi_taxa_id) WHERE dom_id = " + termId + " order by serial";
        sql2 = 'SELECT dom_id as id, kw.*, tg.*, ir.*, ev.*, hf.* FROM domain_segment left join kwd2nodes kwd on dom_id = kwd.node_id left join keywords kw using(kwd_id) left join tags2nodes tgt on dom_id = tgt.node_id left join structural_tags tg using (tag_id) LEFT JOIN ir_nodes_relations irn on dom_id = irn.node_id left join inter_relationships ir using (ir_id) left join hypo_event2nodes_relations henr on dom_id = henr.node_id left join hypothetical_evolutionary_event ev using(event_id) left join descent dsc on dom_id = dsc.node2_id left join hyperfamily hf on dsc.node1_id = hf_id where dom_id = ' + termId;
        // Domains have no children
        sql3 = 'SELECT * from class WHERE cl_id < 0';
    } else if (termRank == 0) {
        sql  = 'SELECT type_id as id, type_name as name, comment as description FROM protein_types WHERE type_id = ' + termId;         
        // Types have no annotations
        sql2 = 'SELECT * from class WHERE cl_id < 0';
        sql3 = "SELECT cf.id, cf.name, cf.description, cf.type, cf.domain, count(*) AS cnum FROM rest_folds cf LEFT JOIN rest_superfamilies sf on cf.id = sf.parent_id WHERE protein_type_id = " + termId + " GROUP BY id, name, description, domain ORDER BY cnum DESC";
    } else {
        return printError(res, "Invalid term id: " + termId);
    }

    if (debug) {
        console.log("SQL ( term )# ", sql);
    }
    
    dbpool.query(sql, function (err, result) {
        if (err) {
            return printError(res, err);
        }         
           
        let tdata = result[0];
        if (termRank == 8) { // in case of domains we construct the name on the fly - it would be good to have it in db
            let dhash = result.reduce( (p, n) => {
                let chain = n.pdb_chain;
                if (p[chain]) {
                    p[chain].push(n.pdb_begin + '-' + n.pdb_end);
                } else {
                    p[chain] = [n.pdb_begin + '-' + n.pdb_end];
                }
                return p;
            }, {});

            let dname = Object.keys(dhash).map( (k) => {
                return (' ' +k+':'+dhash[k].join(','))
            }).join(',');

            tdata.name += dname;

            tdata.pdb_segments = result.map( (ds) => {
                return [ds.pdb_chain, parseInt(ds.pdb_begin), parseInt(ds.pdb_end)]
            } );

            tdata.protein_segments = result.map( (ds) => {
                return [parseInt(ds.seq_begin), parseInt(ds.seq_end)]
            } );
        }
        if (!tdata) {
            return printError(res, "Term not found: " + termId);
        }

        /* Now get all annotations */
        /* saw examples of the same keyword attached twice .. to avoid dispalying multiples we filter them out here */
        if (debug) {
            console.log("SQL ( annos )# ", sql2);
        }

        dbpool.query(sql2, function (err, result) {
            if (err) {
                return printError(res, err);
            } 
            
            tdata.rank = termRank;
            let annotations = {};

            result.map( (i) => {
                if (i.kwd_id > 0) {
                    if (! annotations.keywords) {
                        annotations.keywords = {};
                    }
                    annotations.keywords['k'+i.kwd_id] = { name: i.kwd_txt, description: i.kwd_definition };
                }
                if (i.tag_id > 0) {
                    if (! annotations.keywords) {
                        annotations.keywords = {};
                    }
                    annotations.keywords['t'+i.tag_id] = { name: i.tag_name, description: i.tag_description };
                }
                if (i.ir_id > 0) {
                    if (! annotations.relations) {
                        annotations.relations = {};
                    }
                    annotations.relations['r'+i.ir_id] = { name: i.ir_type + ': ' + i.ir_name, description: i.ir_comment };
                }
                if (i.hf_id > 0) {
                    if (! annotations.relations) {
                        annotations.relations = {};
                    }
                    annotations.relations['h'+i.hf_id] = { name: 'hyperfamily: ' + i.hf_name, description: i.hf_comment };
                }
                if (i.event_id > 0) {
                    if (! annotations.events) {
                        annotations.events = {};
                    }
                    annotations.events[i.event_id] = { name: i.event_name, description: i.event_comment };
                }
            });

            for (annotation_type in annotations) {       
                if (!tdata.annotations) {
                    tdata.annotations = [];
                }
                let annos = [];
                for (e in annotations[annotation_type]) {
                    annos.push(annotations[annotation_type][e]);
                }
                tdata.annotations.push({
                    type: annotation_type,
                    items: annos
                });
            }

            /* Now lets find the children */
            if (debug) {
                console.log("SQL ( term kids )# ", sql3);
            }
          
            dbpool.query(sql3, function (err, result) {
                if (err) {
                    return printError(res, err);
                } 
                tdata.children = [];

              //  console.log(result);


                if ([0,1].includes(tdata.rank)) {
                    tdata.type = 'structural class';
                    /* children can be folds and iupr - need to separate them */
                    const folds = result.filter( (e) => (e.type === 'fold'));
                    const iuprs = result.filter( (e) => (e.type === 'iupr'));
                    if (folds.length) {
                        tdata.children.push(
                            {
                                type:  'fold',
                                nodes: folds
                            }
                        );
                    }
                    if (folds.length) {
                        tdata.children.push(
                            {
                                type: 'iupr',
                                nodes: iuprs
                            }
                        );
                    }
                    if (tdata.rank === 0) {
                        tdata.type = 'protein type';
                        tdata.rank = 1;
                    }
                } else if (tdata.rank == 2) {
                    if (result.length) {
                        tdata.children.push(
                            {
                                type: 'superfamily',
                                nodes: result
                            }
                        );
                    }
                    /* Fold can also be shared by some families */
                    dbpool.query(sql4, function (err, result) {
                        if (err) {
                            return printError(res, err);
                        } 
                        if (result.length) {
                            tdata.children.push( {
                                type: 'alsoShared',
                                nodes: result });
                        }
                        return printTerm(res, tdata); 
                    });      
                    return;         
                } else if (tdata.rank == 3) {
                    tdata.type = 'superfamily';
                    tdata.linkouts = [
                        {
                            type: 'superfamily',
                            name: 'Superfamily'
                        }
                    ];
                    if (result.length) {
                        tdata.children.push(
                            {
                                type: 'family',
                                nodes: result
                            }
                        );
                    }
                } else if (tdata.rank == 4) {
                    tdata.type = 'family';
                    if (debug) {
                        console.log("SQL ( pfam )# ", sql4);
                    }
                    dbpool.query(sql4, function (err, result) {
                        if (err) {
                            return printError(res, err);
                        } 
                        if (result.length) {
                            tdata.linkouts = result;
                        }
                        return printTerm(res, tdata); 
                    });
                    return;
                } else if (tdata.rank == 8) {
                    tdata.type = 'domain';
                }
                return printTerm(res, tdata);
            });
        });
    });
}

function fetchDomainsFromDB(termId, res) {
    const termRank  = Math.floor(termId / 1000000);

    let tdata = {
        id: termId,
        domains: []
    };

    // Only looking for family and superfamily domains
    if (! [3, 4].includes(termRank)) {
        return printTerm(res, tdata);
    }
    
    const sql = "SELECT num, id, serial, type, pdb_id, pdb_chain, pdb_begin, pdb_end, protein_name, uniprot_id, species_name, seq_begin, seq_end FROM rest_domains WHERE node_id = " + termId + " ORDER BY num DESC, id, serial ";
    if (debug) {
        console.log("SQL ( domains )# ", sql);
    }

    dbpool.query(sql, function(err, result) {
        if (err) {
            return printError(res, err);
        }         
    
        if (result.length) {
            let domains = {};
            result.map(i => {
                if (i.id in domains) {
                    domains[i.id]["pdb_regions"].push([i.pdb_chain, parseInt(i.pdb_begin), parseInt(i.pdb_end)])
                    domains[i.id]["protein_regions"].push([parseInt(i.seq_begin), parseInt(i.seq_end)])
                } else {
                    domains[i.id] = {
                        num: i.num,
                        id: i.id,
                        type: i.type,
                        pdb_id: i.pdb_id,
                        protein_name: i.protein_name,
                        uniprot_id: i.uniprot_id,
                        species: i.species_name,
                        pdb_regions: [[i.pdb_chain, parseInt(i.pdb_begin), parseInt(i.pdb_end)]],
                        protein_regions: [[parseInt(i.seq_begin), parseInt(i.seq_end)]]
                    }
                }
            });
            var ids = Object.keys(domains);
            var values = ids.map(function(v) { return domains[v]; });
            tdata.domains = values.sort(function(a,b) { if (a.num > b.num) { return -1;} return 1;});
        }
        return printTerm(res, tdata);
    });
}

function fetchChildrenFromDB(termId, res) {
    const termRank  = Math.floor(termId / 1000000);
    let sql = '';
    let tdata = {
        id: termId,
        children: []
    };

    if (termRank == 1) {
        sql = "SELECT cf.id, cf.name, cf.description, cf.domain, count(*) AS cnum FROM rest_folds cf LEFT JOIN rest_superfamilies sf on cf.id = sf.parent_id WHERE cf.parent_id = " + termId + " GROUP BY id, name, description, domain ORDER BY cnum DESC";
    } else if (termRank == 2) {
        sql = "SELECT sf.id, sf.name, sf.description, sf.domain, count(*) AS cnum FROM rest_superfamilies sf LEFT JOIN rest_families f on sf.id = f.parent_id WHERE sf.parent_id = " + termId  + " OR sf.id IN (SELECT node2_id FROM descent WHERE node1_id = " + termId + ") GROUP BY id, name, description, domain ORDER BY cnum DESC";
    } else if (termRank == 3) {
        sql = "SELECT id, name, description, domain, 0 AS cnum FROM rest_families WHERE parent_id = " + termId + " OR id IN (SELECT node2_id FROM descent WHERE node1_id = " + termId + ")";
    } else if ([4, 8].includes(termRank)) {
        return printTerm(res, tdata);
    } else {
        return printError(res, "Invalid term id: " + termId);
    }

    if (debug) {
        console.log("SQL (children)# ", sql);
    }

    dbpool.query(sql, function (err, result) {
        if (err) {
            return printError(res, err);
        }         
    
        if (result.length) {
            tdata.children = result;
        }
        return printTerm(res, tdata);
    });
}

function fetchAncestryFromDB(termId, res) {
    let nodes = {};
    let edges = [];
    let parents = [];

    let tdata = {
        id: termId,
        lineage: {
            nodes: [],
            edges: []
        }
    };

    const sql  = "SELECT fa_id as id, fa_name as name, sf.sf_id as pid, sf.sf_name as pname, 'superfamily' as ptype from family fa left join superfamily sf using (sf_id) where fa_id =  "+ termId;
    const sql2 = "select sf.sf_id, sf.sf_name, cf.cf_id, cf.cf_name from descent c left join superfamily sf on c.node1_id = sf.sf_id left join fold cf on c.node1_id = cf.cf_id where node2_id = " + termId;
    
    if (debug) {
        console.log("SQL (ancestry-1)# ", sql);
    }

    dbpool.query(sql, function (err, result) {
        if (err) {
            return printError(res, err);
        }         
        if (result.length) {
            const current_node_id = result[0].id;
            nodes[current_node_id] = {
                id: current_node_id,
                name: result[0].name
            };
            nodes[result[0].pid] = {
                id: result[0].pid,
                name: result[0].pname
            };
            
            edges.push([current_node_id, result[0].pid, 'is']);
            parents.push(result[0].pid)
            
            if (debug) {
                console.log("SQL (ancestry-2)# ", sql2);
            }
            dbpool.query(sql2, function (err, result) {
                if (err) {
                    return printError(res, err);
                }         
                if (result.length) {
                    result.map( (i) => {
                        if (i.cf_id) {
                            nodes[i.cf_id] = {
                                id : i.cf_id,
                                name: i.cf_name
                            };
                            edges.push([current_node_id, i.cf_id, "partof"]);
                        }
                        if (i.sf_id) {
                            nodes[i.sf_id] = {
                                id : i.sf_id,
                                name: i.sf_name,
                            }
                            edges.push([current_node_id, i.sf_id, "is"]);
                            parents.push(i.sf_id);
                        }
                    });
                }

                if (parents) {
                    const sql3 = "SELECT sf_id as id, cf.cf_id as pid, cf.cf_name as pname from superfamily sf left join fold cf using (cf_id) where sf_id in (" + parents.join(',') + ")";
                    if (debug) {
                        console.log("SQL (ancestry-3)# ", sql3);
                    }
                    dbpool.query(sql3, function (err, result) {
                        if (err) {
                            return printError(res, err);
                        }         
                   
                        if (result.length) {
                            result.map( (i) => {
                                nodes[i.pid] = {
                                    id : i.pid,
                                    name: i.pname
                                };
                                edges.push([i.id, i.pid, "is"]);
                            });
                        }
                           
                        tdata.lineage = {
                            nodes: nodes,
                            edges: edges
                        }
                        return printTerm(res, tdata);
                    });
                } else {
                    tdata.lineage = {
                        nodes: nodes,
                        edges: edges
                    }
                    return printTerm(res, tdata);
                }
            });
        } else {
            return printTerm(res, tdata);
        }
    });
}

function fetchRepresentedStructuresFromDB(termId, res) {
    const sql = "SELECT member_id as id, member_pdb_code as pdb_id, member_pdb_chain as chain from cluster_members where repre_dom_id =  "+ termId;
    let tdata = {
        id: termId,
        represented: []
    };

    if (debug) {
        console.log("SQL ( represented )# ", sql);
    }
    
    dbpool.query(sql, function (err, result) {
        if (err) {
            return printError(res, err);
        }         
     
        if (result.length) {
            tdata.represented = result;
        }
        return printTerm(res, tdata);
    });
}

function fetchDomainsByUniProtFromDB(uniprot_id, res) {
    const sql = "select pdb_code, pdb_chain, pdb_begin, pdb_end, dom_id, seq_begin, seq_end, domain_type from domain_segment ds left join representative_sequence rs on ds.repre_seq = rs.rep_seq_id left join domain_scop_cla using(dom_id) where ext_db_id = '" + uniprot_id + "' and se_mark = 'ready' and domain_type in ('SF', 'FA') order by serial"
    if (debug) {
        console.log("SQL (doms by Uni)# " + sql);
    }
    let tdata = {
        uniprot_id: uniprot_id
    };

    dbpool.query(sql, function (err, result) {
        if (err) {
            return printError(res, err);
        }         
   
        let dhash = {};
        if (result.length) {
            result.map( (ds) => {
                dom_id = ds.dom_id;
                if (dhash[dom_id]) {
                    dhash[dom_id].pdb_segments.push([ds.pdb_chain, parseInt(ds.pdb_begin), parseInt(ds.pdb_end)]);
                    dhash[dom_id].protein_segments.push([ parseInt(ds.seq_begin), parseInt(ds.seq_end) ]);
                } else {
                    dhash[dom_id] = {
                        id: dom_id,
                        type: ds.domain_type,
                        pdb_code: ds.pdb_code,
                        pdb_segments : [ [ ds.pdb_chain, parseInt(ds.pdb_begin), parseInt(ds.pdb_end) ] ],
                        protein_segments : [ [ parseInt(ds.seq_begin), parseInt(ds.seq_end) ] ]
                    }
                }
            });         
        }
        tdata.domains = dhash;
        return printTerm(res, tdata);
    });
}

function fetchSearchFromDB(qTerm, res) {
    const sql = "SELECT * FROM rest_search WHERE id = '" + qTerm + "' OR name LIKE '%" + qTerm + "%' OR description LIKE '%" + qTerm + "%'";
    const sql2 = "SELECT id, concat_ws(' ', pdb_id, name) as name, 'domain' as type FROM rest_search_id WHERE id = '" + qTerm + "' OR pdb_id = '" + qTerm + "' OR uniprot_id = '" + qTerm + "'";
    
    if (debug) {
        console.log("SQL (search text)# " + sql);
    }
    tdata = {
        query: qTerm,
        results: []
    }

    dbpool.query(sql, function (err, result) {
        if (err) {
            return printError(res, err);
        }
        
        if (result.length) {
            tdata.results = result;
        }

        if (debug) {
            console.log("SQL (search id)# " + sql);
        }
        dbpool.query(sql2, function (err, result) {
            if (err) {
                return printError(res, err);
            }
            if (result.length) {
                if (tdata.results) {
                    tdata.results = [...tdata.results, ...result];
                } else {
                    tdata.results = result;
                }
            }
            return printTerm(res, tdata);
        });
    });
}
