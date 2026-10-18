/** A catalog-admin password does not confer access to somebody else's research. */
export function researchMayRead(ownerId:string,viewerId:string,kind:string,scope:string,hasSpaceGrant:boolean){return ownerId===viewerId||hasSpaceGrant&&(scope==='space'||kind==='space');}
export function normalizedGrantEmail(value:unknown){if(typeof value!=='string'||value.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(value))throw new Error('Enter a valid viewer email address.');return value.trim().toLowerCase();}
