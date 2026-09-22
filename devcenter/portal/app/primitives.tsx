import React, {createContext,useContext,useState} from 'react';
type P=Record<string,any>;
export function Button({variant='default',size='',className='',...p}:P){return <button className={`ui-btn ${variant} ${size} ${className}`} {...p}/>}
export function Input(p:React.InputHTMLAttributes<HTMLInputElement>){return <input className="ui-input" {...p}/>}
export function NativeSelect(p:React.SelectHTMLAttributes<HTMLSelectElement>){return <select className="ui-input" {...p}/>}
const TabCtx=createContext<any>(null);
export function Tabs({defaultValue,children,...p}:P){const [value,set]=useState(defaultValue);return <TabCtx.Provider value={{value,set}}><div {...p}>{children}</div></TabCtx.Provider>}
export function TabsList({variant,...p}:P){return <div data-slot="tabs-list" role="group" aria-label="표시 방식" {...p}/>}
export function TabsTrigger({value,...p}:P){const t=useContext(TabCtx);return <button data-slot="tabs-trigger" aria-pressed={t.value===value} onClick={()=>t.set(value)} {...p}/>}
export function TabsContent({value,children}:P){const t=useContext(TabCtx);return t.value===value?<div>{children}</div>:null}
const NavCtx=createContext<any>(null);
export function SidebarProvider({children,style}:P){const [open,set]=useState(false);return <NavCtx.Provider value={{open,set}}><div className={`app-shell ${open?'nav-open':''}`} style={style}>{children}</div></NavCtx.Provider>}
export function Sidebar({children}:P){return <aside data-slot="sidebar-inner">{children}</aside>}
export function SidebarHeader(p:P){return <div data-slot="sidebar-header" {...p}/>}
export function SidebarContent(p:P){return <div data-slot="sidebar-content" {...p}/>}
export function SidebarFooter(p:P){return <div data-slot="sidebar-footer" {...p}/>}
export function SidebarMenu(p:P){return <nav aria-label="개발센터 메뉴" {...p}/>}
export function SidebarMenuItem(p:P){return <div {...p}/>}
export function SidebarMenuButton({isActive,onClick,...p}:P){const n=useContext(NavCtx);return <button data-slot="sidebar-menu-button" data-active={isActive} aria-current={isActive?'page':undefined} onClick={()=>{onClick?.();n.set(false)}} {...p}/>}
export function SidebarInset(p:P){return <div className="main-inset" {...p}/>}
export function SidebarTrigger(){const n=useContext(NavCtx);return <button data-slot="sidebar-trigger" aria-label="메뉴 열기" aria-expanded={n.open} onClick={()=>n.set(!n.open)}>☰</button>}
