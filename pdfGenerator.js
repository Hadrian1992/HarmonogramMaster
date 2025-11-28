import PdfPrinter from 'pdfmake';

const fonts = {
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};

const printer = new PdfPrinter(fonts);

export function generatePdfBuffer(data, type) {
    return new Promise((resolve, reject) => {
        let docDefinition;

        if (type === 'main') {
            // data is array of workers
            docDefinition = {
                content: [
                    { text: 'Harmonogram Pracy', style: 'header' },
                    {
                        table: {
                            headerRows: 1,
                            widths: ['*', 'auto', 'auto'],
                            body: [
                                ['Pracownik', 'Data', 'Godziny'],
                                ...data.map(w => [w.name, w.date || '-', w.hours + 'h'])
                            ]
                        },
                        layout: {
                            fillColor: function (rowIndex) {
                                return (rowIndex === 0) ? '#3B82F6' : (rowIndex % 2 === 0 ? '#F3F4F6' : null);
                            },
                            hLineColor: () => '#E5E7EB',
                            vLineColor: () => '#E5E7EB',
                            paddingLeft: () => 8,
                            paddingRight: () => 8,
                            paddingTop: () => 6,
                            paddingBottom: () => 6
                        }
                    }
                ],
                styles: {
                    header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] }
                },
                defaultStyle: {
                    font: 'Helvetica'
                }
            };
        } else if (type === 'individual') {
            // data is { worker: { name, ... } }
            const { worker } = data;
            docDefinition = {
                content: [
                    { text: `Harmonogram: ${worker.name}`, style: 'header' },
                    { text: `Miesiąc: ${worker.month || 'Bieżący'}`, style: 'subheader' },
                    { text: '\n' },
                    {
                        table: {
                            headerRows: 1,
                            widths: ['*', 'auto'],
                            body: [
                                ['Data', 'Zmiana'],
                                // Assuming worker.shifts is array of { date, type, hours }
                                ...(worker.shifts || []).map(s => [s.date, `${s.type} (${s.hours}h)`])
                            ]
                        },
                        layout: 'lightHorizontalLines'
                    }
                ],
                styles: {
                    header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5] },
                    subheader: { fontSize: 14, margin: [0, 0, 0, 10] }
                },
                defaultStyle: {
                    font: 'Helvetica'
                }
            };
        }

        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        const chunks = [];

        pdfDoc.on('data', (chunk) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', (err) => reject(err));

        pdfDoc.end();
    });
}
