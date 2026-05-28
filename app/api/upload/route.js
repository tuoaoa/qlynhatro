import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy tệp tin tải lên.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Create public/uploads directory if not exists
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Sanitize filename and make it unique
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniqueFilename = `${Date.now()}_${sanitizedFilename}`;
    const filePath = path.join(uploadDir, uniqueFilename);
    
    fs.writeFileSync(filePath, buffer);
    
    // Static path prefix with Next.js app basePath '/qlynhatro'
    const fileUrl = `/qlynhatro/uploads/${uniqueFilename}`;
    
    return NextResponse.json({ success: true, url: fileUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
