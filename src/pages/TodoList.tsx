import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ListTodo, Plus, Pencil, Trash2, ChevronDown, PartyPopper, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "completed";
  assigned_to: string | null;
  created_by: string | null;
  sort_order: number;
  created_at: string;
  due_date: string | null;
}

interface Profile {
  user_id: string;
  display_name: string | null;
}

const PRIORITY_CONFIG = {
  urgent: { label: "Urgent", color: "bg-red-500/15 text-red-500 border-red-500/30", dot: "bg-red-500", card: "border-l-4 border-l-red-500" },
  high: { label: "High", color: "bg-orange-500/15 text-orange-500 border-orange-500/30", dot: "bg-orange-500", card: "border-l-4 border-l-orange-500" },
  medium: { label: "Medium", color: "bg-blue-500/15 text-blue-500 border-blue-500/30", dot: "bg-blue-500", card: "border-l-4 border-l-blue-500" },
  low: { label: "Low", color: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30", dot: "bg-muted-foreground", card: "border-l-4 border-l-muted" },
};

const PRIORITIES: Array<"urgent" | "high" | "medium" | "low"> = ["urgent", "high", "medium", "low"];

export default function TodoList() {
  const { orgId } = useOrg();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<{ user_id: string }[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [saving, setSaving] = useState(false);
  const [groupBy, setGroupBy] = useState<"priority" | "status">("priority");
  const [showDone, setShowDone] = useState(false);
  const [celebrateId, setCelebrateId] = useState<string | null>(null);

  const loadData = () => {
    if (!orgId) return;
    Promise.all([
      supabase.from("todos").select("*").eq("org_id", orgId).order("sort_order"),
      supabase.from("profiles").select("user_id, display_name"),
      supabase.from("org_members").select("user_id").eq("org_id", orgId),
    ]).then(([t, p, m]) => {
      setTodos((t.data as Todo[]) || []);
      setProfiles(p.data || []);
      setMembers(m.data || []);
    });
  };

  useEffect(() => { loadData(); }, [orgId]);

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach(p => { map[p.user_id] = p.display_name || "Unknown"; });
    return map;
  }, [profiles]);

  const teamMembers = useMemo(() =>
    members.map(m => ({ id: m.user_id, name: profileMap[m.user_id] || "Unknown" })).sort((a, b) => a.name.localeCompare(b.name)),
  [members, profileMap]);

  const pendingTodos = useMemo(() => todos.filter(t => t.status === "pending"), [todos]);
  const completedTodos = useMemo(() => todos.filter(t => t.status === "completed"), [todos]);

  const openCreate = () => {
    setEditing(null); setTitle(""); setDescription(""); setPriority("medium"); setAssignedTo(""); setDueDate(undefined); setShowDialog(true);
  };

  const openEdit = (todo: Todo) => {
    setEditing(todo); setTitle(todo.title); setDescription(todo.description || "");
    setPriority(todo.priority); setAssignedTo(todo.assigned_to || "");
    setDueDate(todo.due_date ? new Date(todo.due_date) : undefined);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !orgId) return;
    setSaving(true);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assigned_to: assignedTo && assignedTo !== "none" ? assignedTo : null,
        org_id: orgId,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      };
      if (editing) {
        const { error } = await supabase.from("todos").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Task updated");
      } else {
        const maxOrder = todos.length > 0 ? Math.max(...todos.map(t => t.sort_order)) + 1 : 0;
        payload.sort_order = maxOrder;
        payload.created_by = (await supabase.auth.getUser()).data.user?.id || null;
        const { error } = await supabase.from("todos").insert(payload);
        if (error) throw error;
        toast.success("Task created");
      }
      setShowDialog(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (todo: Todo) => {
    const newStatus = todo.status === "completed" ? "pending" : "completed";
    await supabase.from("todos").update({ status: newStatus } as any).eq("id", todo.id);

    if (newStatus === "completed") {
      setCelebrateId(todo.id);
      toast("🎉 Well done!", { description: `"${todo.title}" completed!`, duration: 3000 });
      setTimeout(() => setCelebrateId(null), 2000);
    }
    loadData();
  };

  const deleteTodo = async (id: string) => {
    await supabase.from("todos").delete().eq("id", id);
    toast.success("Task deleted");
    loadData();
  };

  const grouped = useMemo(() => {
    if (groupBy === "priority") {
      return PRIORITIES.map(p => ({
        key: p,
        label: PRIORITY_CONFIG[p].label,
        config: PRIORITY_CONFIG[p],
        items: pendingTodos.filter(t => t.priority === p).sort((a, b) => a.sort_order - b.sort_order),
      })).filter(g => g.items.length > 0);
    }
    return [{
      key: "pending", label: "Pending", config: null,
      items: pendingTodos.sort((a, b) => a.sort_order - b.sort_order),
    }].filter(g => g.items.length > 0);
  }, [pendingTodos, groupBy]);

  const pendingCount = pendingTodos.length;
  const completedCount = completedTodos.length;

  const TodoItem = ({ todo }: { todo: Todo }) => (
    <div
      className={cn(
        "px-4 py-3 flex items-start gap-3 transition-all",
        PRIORITY_CONFIG[todo.priority].card,
        todo.status === "completed" && "opacity-50",
        celebrateId === todo.id && "animate-scale-in bg-success/5"
      )}
    >
      <Checkbox
        checked={todo.status === "completed"}
        onCheckedChange={() => toggleComplete(todo)}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm font-medium", todo.status === "completed" && "line-through")}>{todo.title}</p>
          <Badge variant="outline" className={cn("text-[10px]", PRIORITY_CONFIG[todo.priority].color)}>
            {PRIORITY_CONFIG[todo.priority].label}
          </Badge>
        </div>
        {todo.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{todo.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
          {todo.assigned_to && <span>👤 {profileMap[todo.assigned_to] || "Unassigned"}</span>}
          {todo.due_date && (
            <span className={cn(
              "flex items-center gap-1",
              new Date(todo.due_date) < new Date() && todo.status === "pending" && "text-destructive font-medium"
            )}>
              📅 {format(new Date(todo.due_date), "dd MMM")}
            </span>
          )}
          <span>{format(new Date(todo.created_at), "dd MMM")}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(todo)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteTodo(todo.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ListTodo className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">To-Do List</h1>
          <Badge variant="secondary">{pendingCount} pending</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <SelectTrigger className="w-[130px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority">By Priority</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Task
          </Button>
        </div>
      </div>

      {pendingTodos.length === 0 && completedTodos.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">No tasks yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first task to get started.</p>
          <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> Add Task</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.key} className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
                {group.config && <div className={cn("h-2.5 w-2.5 rounded-full", group.config.dot)} />}
                <h3 className="text-sm font-semibold">{group.label}</h3>
                <Badge variant="secondary" className="text-xs">{group.items.length}</Badge>
              </div>
              <div className="divide-y divide-border">
                {group.items.map(todo => <TodoItem key={todo.id} todo={todo} />)}
              </div>
            </div>
          ))}

          {/* Completed tasks collapsible */}
          {completedCount > 0 && (
            <Collapsible open={showDone} onOpenChange={setShowDone}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground">
                  <span className="flex items-center gap-2">
                    <PartyPopper className="h-4 w-4" />
                    Done ({completedCount})
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showDone && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="rounded-xl border bg-card overflow-hidden mt-2">
                  <div className="divide-y divide-border">
                    {completedTodos.map(todo => <TodoItem key={todo.id} todo={todo} />)}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(v) => { if (!v) setShowDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?" />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add details..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>
                        <div className="flex items-center gap-2">
                          <div className={cn("h-2 w-2 rounded-full", PRIORITY_CONFIG[p].dot)} />
                          {PRIORITY_CONFIG[p].label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assign to</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {teamMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <Button onClick={handleSave} disabled={saving || !title.trim()} className="w-full">
              {saving ? "Saving..." : editing ? "Update Task" : "Create Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
