export interface FileItem {
    id: string;
    name: string;
    type: 'file' | 'folder';
    size?: number;
    date: string;
    children?: FileItem[];
}

export const mockFileSystem: FileItem[] = [
    {
        id: '1',
        name: 'Documents',
        type: 'folder',
        date: '2023-10-26 10:00',
        children: [
            { id: '1-1', name: 'Project A', type: 'folder', date: '2023-10-25 14:30', children: [] },
            { id: '1-2', name: 'Resume.pdf', type: 'file', size: 1024 * 500, date: '2023-10-24 09:15' },
        ],
    },
    {
        id: '2',
        name: 'Photos',
        type: 'folder',
        date: '2023-10-26 11:20',
        children: [
            { id: '2-1', name: 'Vacation.jpg', type: 'file', size: 1024 * 2500, date: '2023-09-15 16:45' },
        ],
    },
    {
        id: '3',
        name: 'Notes.txt',
        type: 'file',
        size: 2048,
        date: '2023-10-26 09:00',
    },
];
