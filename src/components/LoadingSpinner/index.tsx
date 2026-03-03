import { View } from '@tarojs/components'
import './index.less'

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
}

export default function LoadingSpinner({ size = 'medium', color = '#999' }: LoadingSpinnerProps) {
  return (
    <View className={`loading-spinner loading-spinner-${size}`}>
      <View 
        className='spinner' 
        style={{ 
          borderTopColor: color, 
          borderRightColor: color,
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent'
        }} 
      />
    </View>
  )
}
