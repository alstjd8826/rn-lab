import { createContext, useContext } from 'react'

/**
 * 화면 스크롤을 맨 위로 올리는 함수.
 *
 * App.tsx 가 ScrollView 하나를 재사용하기 때문에, 레슨을 바꿔도 스크롤
 * 오프셋이 그대로 남는다. 목차에서 아래쪽 항목을 누르면 레슨 중간부터
 * 보이는 문제. 그래서 소유자(App)가 이 함수를 내려주고, 화면이 바뀌는
 * 쪽에서 호출한다.
 */
export const ScrollToTopContext = createContext<() => void>(() => {})

export const useScrollToTop = () => useContext(ScrollToTopContext)
