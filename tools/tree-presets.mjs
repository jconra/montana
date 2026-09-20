export const variants = [
  { name:'pine_large', role:'canopy', preset:'Pine Large', seed:777, tex:'pine', spread:1.18, alphaTest:0.5,
    tweak:o=>{ o.branch.length['1']=10; } },   // shorter mid branches → skinnier through the middle
  { name:'pine_bush',  role:'canopy', preset:'Pine Small', seed:308, tex:'pine', spread:1.42, alphaTest:0.4,
    tweak:o=>{ o.branch.start['1']=0.02;           // child branches start almost at the ground → bushy to the base
               o.branch.children['0']=95;           // moderate branching (perf: fewer tube branches)
               o.branch.length['1']=15;             // side branches wide but not straggly
               o.branch.angle['1']=126;             // sweep them out/down
               o.branch.segments['1']=4;            // fewer radial segments per branch (lighter tubes)
               o.leaves.count=26; o.leaves.size=1.45; o.leaves.start=0; } },  // fewer but bigger leaf cards keep it full
  { name:'aspen',      role:'grove', preset:'Aspen Medium', seed:18020, tex:'aspen', spread:1.2, alphaTest:0.3,
    tweak:o=>{ o.branch.children['0']=20; o.branch.children['1']=5;   // some twigs to hang leaves on
               o.branch.length['1']=9;
               o.leaves.count=17; o.leaves.size=2.9; o.leaves.start=0.05; } },  // less dense crown (see-through, real aspen)
  // ---- distance LODs (same pine textures so they match the detailed pines) ----
  { name:'pine_mid',   role:'mid', preset:'Pine Large', seed:501, tex:'pine', spread:1.28, alphaTest:0.32,
    tweak:o=>{ o.branch.children['0']=12;           // ~10% of the branches…
               o.branch.segments['0']=5; o.branch.segments['1']=3;  // …lighter tubes
               o.leaves.count=10; o.leaves.size=3.2; o.leaves.start=0; } },  // …but big fat foliage clumps to fill the silhouette
  { name:'pine_far',   role:'far', preset:'Pine Large', seed:88, tex:'pine', spread:1.15, alphaTest:0.3,
    tweak:o=>{ o.branch.children['0']=5;             // just a few branches…
               o.branch.start['1']=0.42;             // …up toward the top
               o.branch.segments['0']=4; o.branch.segments['1']=3;
               o.leaves.count=8; o.leaves.size=4.4; o.leaves.start=0.3; } },  // big cards clustered near the crown (crowded-back-forest impostor)
];

// Lab-only candidates. Names describe shape, not verified botanical species.
const pineBase = variants.find(v=>v.name==='pine_bush');
const aspenBase = variants.find(v=>v.name==='aspen');
for (const seed of [1301, 1302, 1303]) variants.push({
  ...pineBase, name:`evergreen_shrub_${seed}`, role:'shrub', seed, spread:1.65,
  displayHeight:1.6, label:`Compact evergreen · ${seed}`, leafTint:0xb4c3a0,
  tweak:o=>{pineBase.tweak(o); o.branch.length['0']=12; o.branch.length['1']=6; o.branch.radius['0']=0.3; o.branch.children['0']=48; o.branch.sections['0']=8;
    o.branch.segments['0']=6; o.branch.segments['1']=3; o.leaves.count=20; o.leaves.size=1.8;}
});
for (const seed of [2401, 2402]) variants.push({
  ...aspenBase, name:`broadleaf_shrub_${seed}`, role:'shrub', seed, spread:1.8,
  displayHeight:1.2, label:`Low broadleaf · ${seed}`, leafTint:0xb7c39d,
  tweak:o=>{aspenBase.tweak(o); o.branch.start['1']=0.08; o.branch.length['0']=3;
    o.branch.length['1']=4; o.branch.length['2']=2; o.branch.radius['0']=0.12;
    o.branch.children['0']=9; o.branch.children['1']=3;
    o.branch.segments['0']=5; o.branch.segments['1']=3;
    o.leaves.count=12; o.leaves.size=1.2;}
});
