const express = require('express');
const PQ = require('pg-promise').ParameterizedQuery;

const db = require('../models');
const {
	checkLoginInfo,
} = require('../utilities');

const router = express.Router();

/*
state_total integer,	// should be just "total" to be consistent with county
jewish integer,
african_american integer,
arab integer,
asian_american integer,
disabled integer,
latinx integer,
lgbtq integer,
muslim integer,
native_american integer,
pacific_islander integer,
sikh integer,
male integer,
female integer,
nonbinary integer,
white integer,
immigrants integer,
trump_supporter integer,
others integer
*/

const totals_columns = ["sum_harassment", "jewish_harassed_total", "african_american_harassed_total", "arab_harassed_total",
						"asian_american_harassed_total", "disabled_harassed_total", "latinx_harassed_total",
						"lgbt_harassed_total", "muslim_harassed_total", "native_american_harassed_total",
						"pacific_islander_harassed_total", "sikh_harassed_total", "women_harassed_total", "men_harassed_total", 
						"girls_harassed_total", "boys_harassed_total", "white_harassed_total", "immigrants_harassed_total",
						"trump_supporter_harassed_total", "others_harassed_total"];
const totals_match_pattern = ['%jewish%', '%african american%', '%arab%', '%asian american%', '%disabled%', '%latinx%', '%lgbt%',
								'%muslim%', '%native american%', '%pacific islander%', '%sikh%', '%male%', '%female%', '%nonbinary%',
								'%white%', '%immigrants%', '%trump supporter%', '%others%'];
const columns = ["jewish", "african_american", "arab", "asian_american", "disabled", "latinx", "lgbtq", "muslim", "native_american",
					"pacific_islander", "sikh", "male", "female", "nonbinary", "white", "immigrants", "trump_supporter", "others"]
const state_table_name = 'us_states';
const county_table_name = 'us_counties';
const state_totals_table_name = 'us_states';	// move to own table
const county_totals_table_name = 'us_counties';
const data_table_name = 'hcmdata';

// TODO, camel+lowercase all columns
const updateState = `update ${state_totals_table_name} set
					state_total = (SELECT count(*) FROM ${data_table_name} as data_table where ST_Intersects(${state_table_name}.geom, ST_SetSRID(ST_MakePoint(data_table.lon, data_table.lat), 4326))),
					${columns.map( (column_name, i) => {
						return (column_name + "= (SELECT count(*) FROM " + data_table_name + " as data_table where data_table.groupsharassed ilike '" + totals_match_pattern[i]
											+ "' and ST_Intersects(" + state_table_name + ".geom, ST_SetSRID(ST_MakePoint(data_table.lon, data_table.lat), 4326)))")
					}).join()};
`;

const updateCounty = `update ${county_totals_table_name} set
					${totals_columns.map( (column_name, i) => {
						return (column_name + "= (SELECT count(*) FROM " + data_table_name + " as data_table where data_table.groupsharassed ilike '" + totals_match_pattern[i]
											+ "' and ST_Intersects(" + county_table_name + ".geom, ST_SetSRID(ST_MakePoint(data_table.lon, data_table.lat), 4326))),")
					})}`;
					

const groups_harassed_column = 'groupsharassed';
// TODO move to globals/resources, as a better data structure
const race_ethnicity = ["'Jewish'", "'African American'", "'Arab'", "'Armenian'", "'Asian American'", "'Latinx'", "'Native American/Indigenous'", "'Pacific Islander'",
						"'Chinese'", "'Japanese American'", "'White'"];
const religion = ["'Muslim'", "'Sikh'"];
const gender = ["'Male'", "'Female'", "'Non-Binary'", "'LGBTQ'"];
const categorizeHarassed = `UPDATE ${data_table_name} SET
							race_ethnicity = array_intersect(groups, (ARRAY[${race_ethnicity.join()}])),
							religion = array_intersect(groups, (ARRAY[${religion.join()}])),
							gender = array_intersect(groups, (ARRAY[${gender.join()}])),
							other = array_diff(groups, (ARRAY[${race_ethnicity.join() + ',' + religion.join() + ',' + gender.join()}]))
							FROM (SELECT string_to_array("${groups_harassed_column}", ',') as groups, id FROM ${data_table_name}) as subquery
							WHERE subquery.id = ${data_table_name}.id`

// CREATE FUNCTION array_intersect(anyarray, anyarray)
//   RETURNS anyarray
//   language sql
// as $FUNCTION$
//     SELECT ARRAY(
//         SELECT UNNEST($1)
//         INTERSECT
//         SELECT UNNEST($2)
//     );
// $FUNCTION$;

// CREATE FUNCTION array_diff(anyarray, anyarray)
// 	RETURNS anyarray
// 	language sql
// as $FUNCTION$
// 	SELECT ARRAY(
// 		SELECT UNNEST($1)
// 		EXCEPT
// 		SELECT UNNEST($2)
// 	);
// $FUNCTION$;

// UPDATE hcmdata SET
// race_ethnicity =  array_intersect(groups, ARRAY['Jewish', 'African American', 'Arab', 'Armenian', 'Asian American', 'Latinx', 'Native American/Indigenous', 'Pacific Islander',
// 'Chinese', 'Japanese American', 'White']),
// religion =  array_intersect(groups, ARRAY['Muslim', 'Sikh']),
// gender =  array_intersect(groups, ARRAY['Male', 'Female', 'Non-Binary', 'LGBTQ'])
// FROM (SELECT string_to_array("groupsharassed", ',') as groups, id FROM hcmdata) as subquery
// WHERE subquery.id = hcmdata.id

const groupsQuery = `WITH RECURSIVE groups_tree AS (
	SELECT id, name, "order", 0 AS level, cast("order" as varchar) AS path
	FROM groups WHERE parent_id is null

	UNION ALL
	
	SELECT g.id, g.name, g."order", level + 1, cast(gt.path || '.' || cast(g."order" as varchar) as varchar)
	FROM groups_tree gt
	INNER JOIN groups g ON (g.parent_id = gt.id)
)
SELECT * from groups_tree
ORDER BY path`

router.use((req, res, next) => {
	/* queries to /totals api go through here first */
	next();
});

const covidQuery = `SELECT "ID", to_char("Date_Incident", 'MM/DD/YY') as date, "Gender" as gender, "City_Updated" as city, "State_Updated" as state, "Ethnicity_Cleaned" as ethnicity, "Type_Discrimination_Cleaned" as type, "Reason_Discrimination_Cleaned", "Description" as description, "Any_SupportingLinks" as link
							FROM aapi_covid_data
							WHERE ("State_Updated" <> 'OTHER' OR ("State_Updated" = 'Other' AND "City_Updated" <> 'Online')) AND "Flag_Troll" = 'false' AND "Date_Incident" > '1/1/2020'::date AND "Date_Incident" < now()::date
							ORDER BY "Date_Incident"`

router.get('/covid', (req, res) => {
	db.any(covidQuery)
	.then(result => {
		res.status(200)
		.json({
			status: 'success',
			result
		});
	})
	.catch(err => console.log('ERROR: ', err));
})

// TODO: redesign
// function formatGroups(results, index, ret, level) {
// 	if(results.length == index) return;

// 	if(results[index].level < level) return;

// 	var item = { name: results[index].name, key: results[index].id };
// 	var children = [];

// 	if(results.length-1 > index && results[index].level < results[index+1].level)	// this has children
// 	{
// 		formatGroups(results, index+1, children, level+1);
// 		item.children = children;
// 	}
// 	else if(results.length-1 > index && results[index].level > results[index+1].level)
// 	{
// 		ret.push(item);
// 		return;
// 	}

// 	ret.push(item);

// 	formatGroups(results, index+1+children.length, ret, level);
// }

function formatGroups(results) {
	var ret = [];
	var parent = [];
	var prev = null;

	for(var i = 0; i < results.length; i++) {
		const currentItem = { name: results[i].name, key: results[i].id , level: results[i].level, children: []};

		for(var k=parent.length;k>currentItem.level;k--){
			parent.pop();
		}

		if(currentItem.level == 0){
			ret.push(currentItem);
		}
		else if(currentItem.level > prev.level){
			parent.push(prev);
			parent[parent.length-1].children.push(currentItem);
		}
		else{
			parent[parent.length-1].children.push(currentItem);
		}

		

		prev = currentItem;
	}

	return ret;
}

router.get('/groups', (req,res) => {
	db.any(groupsQuery)
	.then((result) => {
		const ret = formatGroups(result)
		res.status(200)
		.json({
			status: 'success',
			ret
		});
	})
	.catch(err => console.log('ERROR: ', err));
})

const stateTopCategories = `SELECT us_states.name, groups.name as group, t.count
							FROM (SELECT state_id, i.primary_group_id, COUNT(state_id)
								FROM incident i
								GROUP BY state_id, i.primary_group_id
								ORDER BY state_id
							) t JOIN us_states ON us_states.id = t.state_id JOIN groups ON groups.id = t.primary_group_id
							`
const stateAllCategories = `SELECT us_states.name, g2.name as parent, g1.name as group, t.count
							FROM (SELECT state_id, i.primary_group_id as parent, group_id, COUNT(state_id)
									FROM incident i
									JOIN incident_groups ON i.id = incident_id
									GROUP BY state_id, i.primary_group_id, group_id
									ORDER BY state_id
							) t JOIN us_states ON us_states.id = t.state_id
								JOIN groups g1 ON g1.id = t.group_id
								join groups g2 on g2.id = t.parent
							`
const statePublishedOnly = `SELECT us_states.name, g2.name as parent, g1.name as group, t.count
							FROM (SELECT state_id, i.primary_group_id as parent, group_id, COUNT(state_id)
									FROM incident i
									JOIN incident_groups ON i.id = incident_id
									WHERE i.published = TRUE
									GROUP BY state_id, i.primary_group_id, group_id
									ORDER BY state_id
							) t JOIN us_states ON us_states.id = t.state_id
								JOIN groups g1 ON g1.id = t.group_id
								join groups g2 on g2.id = t.parent
							`
const allReports = `SELECT t.id, to_char(t.incidentdate, 'MM/DD/YY') as date, us_states.name as state, g2.name as parent, g1.name as group, t.published, t.sourceurl as link, t.description
					FROM (SELECT i.id, i.incidentdate, state_id, i.primary_group_id as parent, group_id, published, sourceurl, description
							FROM incident i
							JOIN incident_groups ON i.id = incident_id
					) t JOIN us_states ON us_states.id = t.state_id
						JOIN groups g1 ON g1.id = t.group_id
						JOIN groups g2 ON g2.id = t.parent
						ORDER by date
					`

const partitionedCounts =  `select us.name as state, (uc.name||','||uc.statefp) as county, g2.name as primary_reason, g.name as group, published, extract(year from incidentdate) as yyyy, COUNT(*)::int
							from groups g -- include all groups, even if aggregate of one is 0
							join incident_groups ig on g.id = ig.group_id -- attach the name to all reports
							join incident i on ig.incident_id = i.id
							join groups g2 on i.primary_group_id = g2.id -- attach parent group name. NOTE, ideally we could map 'group' to its primary, but some have a different primary than group
							join us_states us on us.id = i.state_id -- attach the state name
							join us_counties uc on uc.id = i.county_id -- attach the county name
							where incidentdate IS NOT NULL AND incidentdate < now()::date
							group by us.name, (uc.name||','||uc.statefp), g2.name, g.name, published, extract(year from incidentdate)`

router.get('/reports', (req, res) => {
	db.any(allReports)
	.then(result => {
		res.status(200)
		.json({
			status: 'success',
			result
		});
	})
	.catch(err => console.log('ERROR: ', err));
});

// TODO: rename/does not belong here
// NOTE: removed the `WHERE clause g2.name ILIKE $1`, decide whether we want to constrain on the primary reason (parent_group), because the totals # currently does not
router.get('/filtered', (req, res) => {
	let query = `SELECT t.id, to_char(t.incidentdate, 'MM/DD/YY') as date, us_states.name as state, g2.name as parent, g1.name as group, t.published, t.sourceurl as link, t.description
				FROM (SELECT i.id, i.incidentdate, state_id, i.primary_group_id as parent, group_id, published, sourceurl, description
						FROM incident i
						JOIN incident_groups ON i.id = incident_id
				) t JOIN us_states ON us_states.id = t.state_id
						JOIN groups g1 ON g1.id = t.group_id
						JOIN groups g2 ON g2.id = t.parent `;
	({ group, state, published } = req.query);
	if (state == 'all') {
		if (published) {
			(`WHERE g1.name ILIKE $1 AND published=true`);
		} else {
			query += (`WHERE g1.name ILIKE $1`);
		}
	} else {
		if (published) {
			(`WHERE g1.name ILIKE $1 AND published=true AND us_states.name ILIKE $2`);
		} else {
			query += (`WHERE g1.name ILIKE $1 AND us_states.name ILIKE $2`);
		}
	}
	db.any(query, [group, state])
	.then((result) => {
		res.status(200)
		.json({
			status: 'success',
			result
		});
	})
	.catch(err => console.log('ERROR: ', err));
});

router.get('/', (req, res) => {
	db.any(partitionedCounts)
	.then((result) => {
		res.status(200)
		.json({
			status: 'success',
			result
		});
	})
	.catch(err => console.log('ERROR: ', err));
});

router.get('/:filter', (req, res) => {
	let useQuery;
	if (req.params.filter == 'published') {
		userQuery = statePublishedOnly
	}
	db.any(userQuery)
	.then((result) => {
		res.status(200)
		.json({
			status: 'success',
			result
		});
	})
	.catch(err => console.log('ERROR: ', err));
});

router.get('/categorize', (req, res) => {
	db.any(categorizeHarassed)
	.then((result) => {
		res.status(200)
		.json({
			status: 'success',
			result
		});
	})
	.catch(err => console.log('ERROR: ', err));
});



router.get('/update', (req, res) => {
	res.write('Updating totals...');
	db.one(updateState)
	.then((result) => {
		res.status(200)
		.json({
			status: 'success',
			mapdata,
		});
	})
	.catch(err => console.log('ERROR:', err));
});

router.get('/update/:state', (req, res) => {
	db.one(updateState + " WHERE us_states.name ilike '%" + req.params.state + "%'")
	.then(result => {
		res.status(200)
		.json({
			status: 'success',
			result
		});
	})
	.catch(err => console.log('ERROR: ', err));
});

router.get('/category/:category', (req, res) => {
	db.any(`select ${req.params.category + '_harassed_total, sum_harassment, name'} from us_states order by name asc`)
	.then(result => {
		res.status(200)
		.json({
			status: 'success',
			result
		});
	})
	.catch(err => console.log('ERROR: ', err));
});

module.exports = router;