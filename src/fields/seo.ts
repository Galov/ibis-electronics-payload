import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import type { Field } from 'payload'

type SEOFieldArgs = {
  descriptionPath?: string
  imagePath?: string
  titlePath?: string
}

export const buildSEOFields = ({
  descriptionPath = 'meta.description',
  imagePath = 'meta.image',
  titlePath = 'meta.title',
}: SEOFieldArgs = {}): Field[] => [
  OverviewField({
    titlePath,
    descriptionPath,
    imagePath,
  }),
  MetaTitleField({
    hasGenerateFn: true,
  }),
  MetaImageField({
    relationTo: 'media',
  }),
  MetaDescriptionField({}),
  PreviewField({
    hasGenerateFn: true,
    titlePath,
    descriptionPath,
  }),
]
