import { generatePdfBuffer } from './pdfGenerator.js';
import fs from 'fs';

const testWorkers = [
    { name: 'Jan Kowalski', date: '2023-11-01', hours: 168 },
    { name: 'Anna Nowak', date: '2023-11-01', hours: 160 }
];

const testIndividual = {
    worker: {
        name: 'Jan Kowalski',
        month: 'Listopad 2023',
        shifts: [
            { date: '2023-11-01', type: 'WORK', hours: 8 },
            { date: '2023-11-02', type: 'WORK', hours: 8 },
            { date: '2023-11-03', type: 'L4', hours: 8 }
        ]
    }
};

console.log('Generating Main PDF...');
generatePdfBuffer(testWorkers, 'main')
    .then(buffer => {
        fs.writeFileSync('test_schedule_main.pdf', buffer);
        console.log('Main PDF generated: test_schedule_main.pdf');
    })
    .catch(console.error);

console.log('Generating Individual PDF...');
generatePdfBuffer(testIndividual, 'individual')
    .then(buffer => {
        fs.writeFileSync('test_schedule_individual.pdf', buffer);
        console.log('Individual PDF generated: test_schedule_individual.pdf');
    })
    .catch(console.error);
