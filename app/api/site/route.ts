import { SiteContent, Review } from '@/lib/models';
import { connectMongo } from '@/lib/mongodb';
import { defaultSettings, defaultWorkshop } from '@/lib/site-defaults';
export async function GET() {
  try {
    await connectMongo();
    const [content, reviews] = await Promise.all([
      SiteContent.find({ key: { $in: ['workshop', 'settings'] } }).lean(),
      Review.find({ approved: true })
        .select('name vehicle rating text')
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    return Response.json({
      workshop:
        content.find((x) => x.key === 'workshop')?.value || defaultWorkshop,
      settings:
        content.find((x) => x.key === 'settings')?.value || defaultSettings,
      reviews,
    }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400' } });
  } catch {
    return Response.json({
      workshop: defaultWorkshop,
      settings: defaultSettings,
      reviews: [],
    });
  }
}
