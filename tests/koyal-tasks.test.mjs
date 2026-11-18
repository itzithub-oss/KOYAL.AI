import test from "node:test";
import assert from "node:assert/strict";
import { addTask, deleteTask, loadTasks, normalizeTasks, TASK_STORAGE_KEY, updateTask } from "../lib/koyal-tasks.mjs";
function storageMock(){const values=new Map();return {getItem(k){return values.get(k)??null;},setItem(k,v){values.set(k,String(v));}};}
test("adds and reloads a task locally",()=>{const s=storageMock();const list=addTask(s,[],"Read chapter 3",{id:"t1",dueDate:"2026-11-20",notes:"Make notes"});assert.equal(list[0].title,"Read chapter 3");assert.deepEqual(loadTasks(s),list);assert.ok(s.getItem(TASK_STORAGE_KEY));});
test("rejects empty tasks and enforces task limits",()=>{assert.throws(()=>addTask(storageMock(),[],"  "),/title/);const full=Array.from({length:100},(_,i)=>({id:String(i),title:"task "+i}));assert.throws(()=>addTask(storageMock(),full,"extra"),/up to 100/);});
test("normalizes records and ignores invalid dates",()=>{assert.deepEqual(normalizeTasks([{id:"x",title:" A ",dueDate:"tomorrow",done:1}]),[{id:"x",title:"A",notes:"",dueDate:"",done:false,createdAt:0}]);});
test("toggles completion and deletes a task",()=>{const s=storageMock();const list=addTask(s,[],"Revise history",{id:"x"});const done=updateTask(s,list,"x",{done:true});assert.equal(done[0].done,true);assert.deepEqual(deleteTask(s,done,"x"),[]);});
