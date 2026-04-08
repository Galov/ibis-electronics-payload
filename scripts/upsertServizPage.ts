import 'dotenv/config'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import type { Page } from '@/payload-types'

const createHeroRichText = () =>
  ({
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: 'ltr',
      children: [
        {
          type: 'heading',
          tag: 'h1',
          version: 1,
          format: '',
          indent: 0,
          direction: 'ltr',
          children: [
            {
              type: 'text',
              text: 'Сервиз',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
            },
          ],
        },
        {
          type: 'paragraph',
          version: 1,
          format: '',
          indent: 0,
          direction: 'ltr',
          children: [
            {
              type: 'text',
              text: 'Ремонт и диагностика на битова техника и електроника.',
              version: 1,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
            },
          ],
        },
      ],
    },
  }) satisfies NonNullable<NonNullable<Page['hero']>['richText']>

async function main() {
  const payload = await getPayload({ config: configPromise })

  const layout = [
    {
      blockType: 'serviceCards' as const,
      blockName: 'Основни сервизни направления',
      eyebrow: 'С какво можем да помогнем',
      title: 'Основни направления',
      description: 'Работим по масови модели и поддържаме резервни части за голяма част от тях.',
      items: [
        {
          title: 'Телевизори',
          description: 'Диагностика и ремонт на телевизори от популярни марки.',
          tags: [
            { label: 'LG' },
            { label: 'Samsung' },
            { label: 'Toshiba' },
            { label: 'Hitachi' },
            { label: 'Vestel' },
          ],
          highlights: [
            { text: 'Оценка преди ремонт' },
            { text: 'Работа по масови модели' },
            { text: 'Консултация при нужда' },
          ],
        },
        {
          title: 'Кафемашини и кафеавтомати',
          description: 'Сервиз и поддръжка на кафемашини, кафеавтомати и капсулни машини.',
          tags: [
            { label: 'Delonghi' },
            { label: 'Капсулни машини' },
            { label: 'Кафеавтомати' },
          ],
          highlights: [
            { text: 'Ремонт и поддръжка' },
            { text: 'Консумативи и аксесоари' },
            { text: 'Оригинални части при нужда' },
          ],
        },
        {
          title: 'Отоплителни уреди',
          description: 'Ремонт на отоплителни уреди за дома.',
          tags: [{ label: 'Tesy' }, { label: 'Delonghi' }],
          highlights: [
            { text: 'Често търсени резервни части' },
            { text: 'Сезонна поддръжка' },
            { text: 'Ремонт при повреда' },
          ],
        },
        {
          title: 'Прахосмукачки и аксесоари',
          description: 'Ремонт на прахосмукачки и съдействие с части и аксесоари.',
          highlights: [
            { text: 'Маркучи, тръби, четки и мотори' },
            { text: 'Ремонт с подходящи части' },
            { text: 'Консумативи при наличие' },
          ],
        },
        {
          title: 'Стъклокерамични плотове',
          description: 'Ремонт на стъклокерамични плотове.',
          highlights: [
            { text: 'Често срещани повреди' },
            { text: 'Налични компоненти за част от моделите' },
          ],
        },
        {
          title: 'Микровълнови фурни',
          description: 'Ремонт на микровълнови фурни и съдействие с резервни части.',
          highlights: [
            { text: 'Диагностика и ремонт' },
            { text: 'Части при наличие' },
          ],
        },
      ],
    },
    {
      blockType: 'infoSteps' as const,
      blockName: 'Срокове на обслужване',
      eyebrow: 'Срокове и приоритет',
      title: 'Срокове на обслужване',
      description: 'Срокът зависи от натовареността и наличността на части.',
      items: [
        {
          title: 'Стандартен ремонт',
          summary: '5 до 7 работни дни',
          description: 'За повечето случаи. Не включва забавяне при изчакване на части.',
        },
        {
          title: 'Бърза услуга',
          summary: 'До 3 работни дни',
          description: 'Приоритетно обслужване. Доплащат се 30% върху стойността на труда.',
        },
        {
          title: 'Експресна услуга',
          summary: 'До 24 часа',
          description: 'За спешни случаи. Доплащат се 50% върху стойността на труда.',
        },
      ],
    },
    {
      blockType: 'serviceCards' as const,
      blockName: 'Как подхождаме',
      eyebrow: 'Нашият подход',
      title: 'Как работим',
      description: 'Първо преценяваме случая, после предлагаме решение.',
      items: [
        {
          title: 'Честна оценка',
          description: 'Казваме дали ремонтът е рентабилен.',
          highlights: [
            { text: 'Ясна преценка' },
            { text: 'Съобразяване със стойността на уреда' },
          ],
        },
        {
          title: 'Наличност на части',
          description: 'Казваме предварително, ако ще се чака доставка.',
          highlights: [
            { text: 'По-ясен срок' },
            { text: 'По-бърза работа при масови модели' },
          ],
        },
        {
          title: 'Консултация',
          description: 'Можеш да се свържеш с нас и преди да донесеш уреда.',
          highlights: [
            { text: 'Подходящо за по-стари уреди' },
            { text: 'Пести време' },
          ],
        },
      ],
    },
  ] satisfies NonNullable<Page['layout']>

  const pageData = {
    _status: 'published' as const,
    slug: 'serviz',
    title: 'Сервиз',
    hero: {
      type: 'lowImpact' as const,
      richText: createHeroRichText(),
    },
    meta: {
      title: 'Сервиз | Ibis Electronics',
      description:
        'Сервиз на Ibis Electronics за ремонт на телевизори, кафемашини, отоплителни уреди, прахосмукачки, стъклокерамични плотове и микровълнови фурни.',
    },
    layout,
  } satisfies Partial<Page>

  const existing = await payload.find({
    collection: 'pages',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: {
      slug: {
        equals: 'serviz',
      },
    },
  })

  if (existing.docs[0]) {
    await payload.update({
      collection: 'pages',
      id: existing.docs[0].id,
      context: {
        disableRevalidate: true,
      },
      data: pageData,
      overrideAccess: true,
    })

    console.log(`Updated page: serviz (${existing.docs[0].id})`)
    return
  }

  const created = await payload.create({
    collection: 'pages',
    context: {
      disableRevalidate: true,
    },
    data: pageData,
    overrideAccess: true,
  })

  console.log(`Created page: serviz (${created.id})`)
}

void main()
