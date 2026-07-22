import type { ImgHTMLAttributes } from 'react'

export const LOGO_SRC = '/logoDeereMax.jpeg'

type LogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>

export function Logo({ alt = 'DeereMax', className, ...rest }: LogoProps) {
  const classes = ['dm-logo', className].filter(Boolean).join(' ')
  return <img src={LOGO_SRC} alt={alt} className={classes} decoding="async" {...rest} />
}