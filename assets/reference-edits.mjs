const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
// Three-way update: carry photo corrections into an older browser draft only
// where the user has not independently changed/deleted that same object.
export function applyReferenceEdits(state,changes){
 let count=0;
 for(const edit of changes){
  const current=state.get(edit.id);
  if(!equal(current??null,edit.before??null))continue;
  if(edit.after)state.set(edit.after);else state.remove(edit.id);
  count++;
 }
 return count;
}
