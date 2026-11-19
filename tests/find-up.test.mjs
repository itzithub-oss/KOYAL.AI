import test from "node:test";
import assert from "node:assert/strict";
import { inferFindUpQuery, rankFindUpBusinesses, validateFindUpApplication } from "../lib/find-up.mjs";

const listings = [
  { id:"1",business_id:"FU-1",business_name:"City Physio",category:"Healthcare",subcategory:"Physiotherapy",description:"Sports injury and back pain rehabilitation",status:"APPROVED",services:[{name:"Sports physiotherapy",keywords:["back pain","injury"]}],location:{city:"Jalpaiguri",state:"West Bengal"},pricing:{starting_price:300} },
  { id:"2",business_id:"FU-2",business_name:"Pending Physio",category:"Healthcare",description:"Physiotherapy",status:"PENDING",services:[{name:"Physiotherapy"}],location:{city:"Jalpaiguri"} },
  { id:"3",business_id:"FU-3",business_name:"Laptop Care",category:"Computer & Electronics",description:"Laptop and computer repair",status:"APPROVED",services:[{name:"Laptop repair"}],location:{city:"Siliguri"},pricing:{starting_price:500} },
];

test("natural-language query infers service category, location and budget",()=>{
  const parsed=inferFindUpQuery("I need a physiotherapist in Jalpaiguri under ₹500 for back pain");
  assert.equal(parsed.category,"Healthcare");
  assert.match(parsed.location,/jalpaiguri/i);
  assert.equal(parsed.budget,500);
  assert.ok(parsed.terms.includes("physiotherapy"));
});

test("public search returns only approved matching listings",()=>{
  const result=rankFindUpBusinesses(listings,"I need a physiotherapist for back pain",{location:"Jalpaiguri"});
  assert.deepEqual(result.map((item)=>item.business_id),["FU-1"]);
});

test("typo-tolerant search finds the relevant approved business",()=>{
  const result=rankFindUpBusinesses(listings,"laptpo repar",{location:"Siliguri"});
  assert.equal(result[0]?.business_id,"FU-3");
});

test("explicit category and price filters are applied",()=>{
  const result=rankFindUpBusinesses(listings,"",{category:"Computer & Electronics",maxPrice:"400"});
  assert.equal(result.length,0);
});

test("unrelated searches do not return arbitrary approved businesses",()=>{
  assert.equal(rankFindUpBusinesses(listings,"unrelated space tourism").length,0);
});

test("location-only searches can return approved businesses in that location",()=>{
  assert.equal(rankFindUpBusinesses(listings,"near Jalpaiguri").length,1);
  assert.equal(rankFindUpBusinesses(listings,"Jalpaiguri").length,1);
});

test("an explicit price filter excludes listings with unknown prices",()=>{
  const unknownPrice={...listings[0],id:"4",business_id:"FU-4",pricing:{}};
  assert.equal(rankFindUpBusinesses([unknownPrice],"physiotherapy",{maxPrice:"1000"}).length,0);
});

test("application validation requires core business and owner details",()=>{
  const errors=validateFindUpApplication({business_name:"",category:"",description:"short",owner_name:"",owner_phone:"",city:"",state:"",services:[]});
  assert.equal(errors.length,8);
});
