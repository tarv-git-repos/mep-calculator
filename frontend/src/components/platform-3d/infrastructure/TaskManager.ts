export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Task<T = any> {
    id: string;
    name: string;
    execute: () => Promise<T>;
    status: TaskStatus;
    progress: number;
    error?: Error;
}

export class TaskManager {
    private tasks: Map<string, Task> = new Map();

    async run<T>(task: Task<T>): Promise<T> {
        this.tasks.set(task.id, task);
        task.status = 'running';
        task.progress = 0;
        
        try {
            const result = await task.execute();
            task.status = 'completed';
            task.progress = 100;
            return result;
        } catch (error: any) {
            task.status = 'failed';
            task.error = error;
            throw error;
        }
    }

    getTask(id: string): Task | undefined {
        return this.tasks.get(id);
    }
}

export const taskManager = new TaskManager();
